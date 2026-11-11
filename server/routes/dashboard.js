import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { DOCUMENTED_SQL, GAPS } from '../lib/flows.js';

const router = Router();

// GET /api/dashboard → everything the home screen needs, in one request
router.get('/', async (_req, res) => {
  const [counts, stepCounts, documented, folders, unfiled, apps, recentFlows, activity] = await Promise.all([
    queryOne(
      `SELECT COUNT(*) AS flows,
              COUNT(CASE WHEN status = 'active' THEN 1 END) AS active,
              COUNT(CASE WHEN status = 'inactive' THEN 1 END) AS inactive,
              COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft
         FROM flows`,
    ),
    queryOne(
      `SELECT COUNT(*) AS steps,
              COUNT(CASE WHEN kind = 'router' THEN 1 END) AS routers,
              COUNT(CASE WHEN kind = 'route' THEN 1 END) AS routes
         FROM steps`,
    ),
    queryOne(`SELECT COUNT(*) AS n FROM flows f WHERE ${DOCUMENTED_SQL}`),
    query('SELECT folder, COUNT(*) AS count FROM flows WHERE folder IS NOT NULL GROUP BY folder ORDER BY count DESC, folder ASC'),
    queryOne('SELECT COUNT(*) AS n FROM flows WHERE folder IS NULL'),
    query(
      `SELECT MIN(app) AS app, COUNT(DISTINCT flow_id) AS flows FROM (
          SELECT flow_id, app FROM steps WHERE app IS NOT NULL
          UNION ALL
          SELECT id AS flow_id, trigger_app AS app FROM flows WHERE trigger_app IS NOT NULL
       ) x GROUP BY LOWER(app) ORDER BY flows DESC, app ASC`,
    ),
    query(
      `SELECT f.id, f.name, f.status, f.folder, f.updated_at, u.name AS updated_by_name,
              (SELECT COUNT(*) FROM steps s WHERE s.flow_id = f.id) AS steps_count
         FROM flows f LEFT JOIN users u ON u.id = f.updated_by
        ORDER BY f.updated_at DESC, f.id DESC LIMIT 6`,
    ),
    query(
      `SELECT a.*, f.name AS flow_name FROM activity a LEFT JOIN flows f ON f.id = a.flow_id
        ORDER BY a.id DESC LIMIT 8`,
    ),
  ]);

  const gaps = await Promise.all(
    Object.entries(GAPS).map(async ([key, gap]) => {
      const [row, sample] = await Promise.all([
        queryOne(`SELECT COUNT(*) AS n FROM flows f WHERE ${gap.sql}`),
        query(`SELECT f.id, f.name FROM flows f WHERE ${gap.sql} ORDER BY f.updated_at DESC LIMIT 3`),
      ]);
      return { key, label: gap.label, hint: gap.hint, count: Number(row.n), sample };
    }),
  );

  res.json({
    counts: {
      flows: Number(counts.flows),
      active: Number(counts.active),
      inactive: Number(counts.inactive),
      draft: Number(counts.draft),
      steps: Number(stepCounts.steps),
      routers: Number(stepCounts.routers),
      routes: Number(stepCounts.routes),
      apps: apps.length,
      documented: Number(documented.n),
    },
    folders: folders.slice(0, 8).map((f) => ({ folder: f.folder, count: Number(f.count) })),
    more_folders: Math.max(0, folders.length - 8),
    unfiled: Number(unfiled.n),
    apps: apps.slice(0, 8).map((a) => ({ app: a.app, flows: Number(a.flows) })),
    gaps,
    recent_flows: recentFlows.map((f) => ({ ...f, steps_count: Number(f.steps_count) })),
    activity,
  });
});

export default router;
