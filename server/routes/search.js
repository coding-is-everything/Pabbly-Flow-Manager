import { Router } from 'express';
import { query } from '../db.js';
import { badRequest } from '../lib/http.js';
import { escapeLike } from '../lib/flows.js';
import { numberSteps, stepLabel } from '../lib/steps.js';

const router = Router();

// GET /api/search?q=gallabox → matching flows and matching steps (with their step number and path)
router.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) throw badRequest('Type at least 2 characters to search');
  const like = `%${escapeLike(q)}%`;

  const flowCols = ['name', 'folder', 'description', 'webhook_url', 'pabbly_url', 'tags', 'owner', 'trigger_app', 'notes'];
  const flows = await query(
    `SELECT id, name, folder, status, trigger_app, description, webhook_url, tags
       FROM flows WHERE ${flowCols.map((c) => `${c} LIKE ?`).join(' OR ')}
      ORDER BY name LIMIT 100`,
    flowCols.map(() => like),
  );

  const stepCols = ['s.app', 's.event', 's.title', 's.condition_text', 's.description', 's.notes'];
  const steps = await query(
    `SELECT s.id, s.flow_id, s.parent_id, s.kind, s.title, s.app, s.event, s.condition_text, s.description,
            f.name AS flow_name, f.status AS flow_status
       FROM steps s JOIN flows f ON f.id = s.flow_id
      WHERE ${stepCols.map((c) => `${c} LIKE ?`).join(' OR ')}
      ORDER BY f.name, s.flow_id, s.id
      LIMIT 500`,
    stepCols.map(() => like),
  );

  // Work out "4.2.1"-style numbers and the router/route path for each matching step.
  const flowIds = [...new Set(steps.map((s) => s.flow_id))];
  if (flowIds.length) {
    const all = await query('SELECT id, flow_id, parent_id, position, kind, title, app, event FROM steps WHERE flow_id IN (?)', [flowIds]);
    const byFlow = new Map();
    for (const row of all) {
      if (!byFlow.has(row.flow_id)) byFlow.set(row.flow_id, []);
      byFlow.get(row.flow_id).push(row);
    }
    const numbers = new Map();
    const byId = new Map(all.map((r) => [r.id, r]));
    for (const rows of byFlow.values()) {
      for (const [id, num] of numberSteps(rows)) numbers.set(id, num);
    }
    for (const s of steps) {
      s.number = numbers.get(s.id) || '';
      const path = [];
      let parent = byId.get(s.parent_id);
      while (parent) {
        path.unshift(`${parent.kind === 'route' ? 'Route' : parent.kind === 'router' ? 'Router' : parent.kind} ${numbers.get(parent.id)}: ${stepLabel(parent)}`);
        parent = byId.get(parent.parent_id);
      }
      s.path = path;
    }
  }

  res.json({ q, flows, steps });
});

export default router;
