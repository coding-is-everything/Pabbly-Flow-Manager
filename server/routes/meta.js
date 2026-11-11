import { Router } from 'express';
import { query, queryOne } from '../db.js';

const router = Router();

// GET /api/meta → dashboard numbers + lists used by filters and autocomplete
router.get('/', async (_req, res) => {
  const counts = await queryOne(
    `SELECT COUNT(*) AS flows,
            COUNT(CASE WHEN status = 'active' THEN 1 END) AS active,
            COUNT(CASE WHEN status = 'inactive' THEN 1 END) AS inactive,
            COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft
       FROM flows`,
  );
  const stepCounts = await queryOne(
    `SELECT COUNT(*) AS steps,
            COUNT(CASE WHEN kind = 'router' THEN 1 END) AS routers,
            COUNT(CASE WHEN kind = 'route' THEN 1 END) AS routes
       FROM steps`,
  );
  const folders = await query(
    `SELECT folder, COUNT(*) AS count FROM flows WHERE folder IS NOT NULL GROUP BY folder ORDER BY folder`,
  );
  const unfiled = await queryOne('SELECT COUNT(*) AS count FROM flows WHERE folder IS NULL');
  const apps = await query(
    `SELECT MIN(app) AS app, COUNT(DISTINCT flow_id) AS flows FROM (
        SELECT flow_id, app FROM steps WHERE app IS NOT NULL
        UNION ALL
        SELECT id AS flow_id, trigger_app AS app FROM flows WHERE trigger_app IS NOT NULL
     ) x GROUP BY LOWER(app) ORDER BY flows DESC, app ASC`,
  );
  const owners = await query('SELECT DISTINCT owner FROM flows WHERE owner IS NOT NULL ORDER BY owner');
  const tagRows = await query('SELECT tags FROM flows WHERE tags IS NOT NULL');

  const tagCounts = new Map();
  for (const { tags } of tagRows) {
    for (const t of tags.split(',').map((x) => x.trim()).filter(Boolean)) {
      const key = t.toLowerCase();
      const entry = tagCounts.get(key) || { tag: t, count: 0 };
      entry.count++;
      tagCounts.set(key, entry);
    }
  }

  res.json({
    counts: {
      flows: Number(counts.flows), active: Number(counts.active), inactive: Number(counts.inactive), draft: Number(counts.draft),
      steps: Number(stepCounts.steps), routers: Number(stepCounts.routers), routes: Number(stepCounts.routes),
    },
    folders: folders.map((f) => ({ folder: f.folder, count: Number(f.count) })),
    unfiled: Number(unfiled.count),
    apps: apps.map((a) => ({ app: a.app, flows: Number(a.flows) })),
    owners: owners.map((o) => o.owner),
    tags: [...tagCounts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
  });
});

export default router;
