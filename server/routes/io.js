import { Router } from 'express';
import { query, transaction } from '../db.js';
import { badRequest } from '../lib/http.js';
import { canEdit } from '../lib/auth.js';
import { oneOf } from '../lib/validate.js';
import { flowFields } from '../lib/flows.js';
import { buildTree, exportTree, insertTree } from '../lib/steps.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

const EXPORT_FIELDS = ['name', 'folder', 'status', 'pabbly_url', 'webhook_url', 'trigger_app', 'description', 'owner', 'tags', 'notes'];

// GET /api/export → full backup: every flow with its nested steps (no database ids)
router.get('/export', async (_req, res) => {
  const flows = await query('SELECT * FROM flows ORDER BY name');
  const steps = await query('SELECT * FROM steps');
  const byFlow = new Map();
  for (const s of steps) {
    if (!byFlow.has(s.flow_id)) byFlow.set(s.flow_id, []);
    byFlow.get(s.flow_id).push(s);
  }
  const out = flows.map((f) => {
    const flow = {};
    for (const key of EXPORT_FIELDS) if (f[key] !== null && f[key] !== '') flow[key] = f[key];
    flow.steps = exportTree(buildTree(byFlow.get(f.id) || []));
    return flow;
  });
  res.json({ app: 'pabbly-flow-manager', version: 1, exported_at: new Date().toISOString(), flows: out });
});

/**
 * POST /api/import  { mode: "skip" | "update" | "create", source?: "csv" | "json", flows: [...] }
 * Flows are matched to existing ones by name (case-insensitive).
 *  - skip:   existing flows are left alone
 *  - update: fields present in the row overwrite the existing flow; if the row has a "steps"
 *            list, the existing steps are replaced by it
 *  - create: always create a new flow, even if the name exists
 * Each flow is imported in its own transaction, so one bad row does not stop the rest.
 */
router.post('/import', canEdit, async (req, res) => {
  const mode = oneOf(req.body?.mode, ['skip', 'update', 'create'], 'mode', 'skip');
  const source = req.body?.source === 'json' ? 'JSON' : 'CSV';
  const flows = req.body?.flows;
  if (!Array.isArray(flows) || !flows.length) throw badRequest('No flows to import');
  if (flows.length > 2000) throw badRequest('Import at most 2000 flows at a time');

  const summary = { created: 0, updated: 0, skipped: 0, steps: 0, errors: [] };

  for (let i = 0; i < flows.length; i++) {
    const row = flows[i] || {};
    const label = row.name ? String(row.name).slice(0, 80) : `(row ${i + 1})`;
    try {
      const hasSteps = Array.isArray(row.steps);
      const [existing] = row.name && mode !== 'create'
        ? await query('SELECT id FROM flows WHERE name = ? ORDER BY id LIMIT 1', [String(row.name).trim()])
        : [];

      if (existing && mode === 'skip') {
        summary.skipped++;
        continue;
      }

      if (existing && mode === 'update') {
        const fields = flowFields(row, true);
        delete fields.name; // name is the match key
        await transaction(async (conn) => {
          const keys = Object.keys(fields);
          await conn.query(
            `UPDATE flows SET ${keys.map((k) => `${k} = ?`).join(', ')}${keys.length ? ', ' : ''}updated_by = ? WHERE id = ?`,
            [...keys.map((k) => fields[k]), req.user.id, existing.id],
          );
          if (hasSteps) {
            await conn.query('UPDATE steps SET parent_id = NULL WHERE flow_id = ?', [existing.id]);
            await conn.query('DELETE FROM steps WHERE flow_id = ?', [existing.id]);
            summary.steps += await insertTree(conn, existing.id, row.steps);
          }
        });
        summary.updated++;
        continue;
      }

      const fields = flowFields(row);
      await transaction(async (conn) => {
        const [result] = await conn.query(
          `INSERT INTO flows (name, folder, status, pabbly_url, webhook_url, trigger_app, description, owner, tags, notes, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [fields.name, fields.folder, fields.status, fields.pabbly_url, fields.webhook_url, fields.trigger_app,
            fields.description, fields.owner, fields.tags, fields.notes, req.user.id, req.user.id],
        );
        if (hasSteps) summary.steps += await insertTree(conn, result.insertId, row.steps);
      });
      summary.created++;
    } catch (err) {
      if (!err.status || err.status >= 500) console.error('Import row failed:', err);
      summary.errors.push({ row: i + 1, name: label, error: err.status && err.status < 500 ? err.message : 'Server error while saving this row' });
    }
  }

  if (summary.created || summary.updated) {
    await logActivity(req, {
      action: 'import', entity: 'flow',
      summary: `${source} import: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.errors.length} failed`,
    });
  }
  res.json(summary);
});

export default router;
