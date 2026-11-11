import { Router } from 'express';
import { query, queryOne, transaction } from '../db.js';
import { badRequest, notFound, toId } from '../lib/http.js';
import { adminOnly, canEdit } from '../lib/auth.js';
import { STEP_KINDS, oneOf } from '../lib/validate.js';
import { FLOW_FIELD_LABELS, GAPS, escapeLike, flowFields } from '../lib/flows.js';
import { buildTree, insertTree, normalizeSiblings, placementError, stepFields, stepLabel } from '../lib/steps.js';
import { logActivity, touchFlow } from '../lib/activity.js';

const router = Router();

const SORTS = {
  updated: 'f.updated_at DESC, f.id DESC',
  name: 'f.name ASC, f.id ASC',
  created: 'f.created_at DESC, f.id DESC',
};

// GET /api/flows?q=&status=&folder=&app=&tag=&sort=
router.get('/', async (req, res) => {
  const where = [];
  const params = [];
  const { q, status, folder, app, tag } = req.query;

  if (q && String(q).trim()) {
    const like = `%${escapeLike(String(q).trim())}%`;
    const cols = ['f.name', 'f.description', 'f.folder', 'f.webhook_url', 'f.pabbly_url', 'f.tags', 'f.owner', 'f.trigger_app', 'f.notes'];
    where.push(`(${cols.map((c) => `${c} LIKE ?`).join(' OR ')})`);
    params.push(...cols.map(() => like));
  }
  if (status) {
    where.push('f.status = ?');
    params.push(String(status));
  }
  if (folder === '__none__') where.push('(f.folder IS NULL)');
  else if (folder) {
    where.push('f.folder = ?');
    params.push(String(folder));
  }
  if (app) {
    where.push('(f.trigger_app = ? OR EXISTS (SELECT 1 FROM steps s WHERE s.flow_id = f.id AND s.app = ?))');
    params.push(String(app), String(app));
  }
  if (tag) {
    where.push("CONCAT(', ', f.tags, ', ') LIKE ?");
    params.push(`%, ${escapeLike(String(tag).trim())}, %`);
  }
  // ?gap=no_steps | no_link | no_owner | no_webhook | empty_branch (see GAPS in lib/flows.js)
  if (req.query.gap) {
    const gap = GAPS[String(req.query.gap)];
    if (!gap) throw badRequest(`Unknown gap filter. Use one of: ${Object.keys(GAPS).join(', ')}`);
    where.push(`(${gap.sql})`);
  }

  const order = SORTS[req.query.sort] || SORTS.updated;
  const flows = await query(
    `SELECT f.id, f.name, f.folder, f.status, f.pabbly_url, f.webhook_url, f.trigger_app, f.description, f.owner, f.tags,
            f.created_at, f.updated_at, u.name AS updated_by_name,
            (SELECT COUNT(*) FROM steps s WHERE s.flow_id = f.id) AS steps_count,
            (SELECT COUNT(*) FROM steps s WHERE s.flow_id = f.id AND s.kind = 'router') AS routers_count
       FROM flows f
       LEFT JOIN users u ON u.id = f.updated_by
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${order}
      LIMIT 2000`,
    params,
  );
  res.json({ flows });
});

async function loadFlow(id) {
  const flow = await queryOne(
    `SELECT f.*, cu.name AS created_by_name, uu.name AS updated_by_name
       FROM flows f
       LEFT JOIN users cu ON cu.id = f.created_by
       LEFT JOIN users uu ON uu.id = f.updated_by
      WHERE f.id = ?`,
    [id],
  );
  if (!flow) throw notFound('Flow not found');
  return flow;
}

router.get('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const flow = await loadFlow(id);
  const steps = await query('SELECT * FROM steps WHERE flow_id = ?', [id]);
  res.json({ flow, steps: buildTree(steps) });
});

router.post('/', canEdit, async (req, res) => {
  const fields = flowFields(req.body || {});
  const result = await query(
    `INSERT INTO flows (name, folder, status, pabbly_url, webhook_url, trigger_app, description, owner, tags, notes, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [fields.name, fields.folder, fields.status, fields.pabbly_url, fields.webhook_url, fields.trigger_app,
      fields.description, fields.owner, fields.tags, fields.notes, req.user.id, req.user.id],
  );
  await logActivity(req, { action: 'create', entity: 'flow', entityId: result.insertId, flowId: result.insertId, summary: `Created flow "${fields.name}"` });
  res.status(201).json({ flow: await loadFlow(result.insertId) });
});

router.patch('/:id', canEdit, async (req, res) => {
  const id = toId(req.params.id);
  const before = await loadFlow(id);
  const fields = flowFields(req.body || {}, true);
  const keys = Object.keys(fields);
  if (!keys.length) throw badRequest('Nothing to update');

  await query(
    `UPDATE flows SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_by = ? WHERE id = ?`,
    [...keys.map((k) => fields[k]), req.user.id, id],
  );
  const changed = keys.filter((k) => (before[k] ?? null) !== (fields[k] ?? null));
  if (changed.length) {
    const statusNote = changed.includes('status') ? ` (now ${fields.status})` : '';
    await logActivity(req, {
      action: 'update', entity: 'flow', entityId: id, flowId: id,
      summary: `Edited ${changed.map((k) => FLOW_FIELD_LABELS[k]).join(', ')} of "${fields.name || before.name}"${statusNote}`,
    });
  }
  res.json({ flow: await loadFlow(id) });
});

router.delete('/:id', adminOnly, async (req, res) => {
  const id = toId(req.params.id);
  const flow = await loadFlow(id);
  await transaction(async (conn) => {
    // Detach the tree first so the delete works with or without FK cascade support (e.g. older TiDB).
    await conn.query('UPDATE steps SET parent_id = NULL WHERE flow_id = ?', [id]);
    await conn.query('DELETE FROM steps WHERE flow_id = ?', [id]);
    await conn.query('DELETE FROM flows WHERE id = ?', [id]);
    await logActivity(req, { action: 'delete', entity: 'flow', entityId: id, flowId: id, summary: `Deleted flow "${flow.name}"` }, conn);
  });
  res.json({ ok: true });
});

router.post('/:id/duplicate', canEdit, async (req, res) => {
  const id = toId(req.params.id);
  const flow = await loadFlow(id);
  const steps = buildTree(await query('SELECT * FROM steps WHERE flow_id = ?', [id]));

  const newId = await transaction(async (conn) => {
    const name = `Copy of ${flow.name}`.slice(0, 255);
    const [result] = await conn.query(
      `INSERT INTO flows (name, folder, status, pabbly_url, webhook_url, trigger_app, description, owner, tags, notes, created_by, updated_by)
       VALUES (?, ?, 'draft', NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [name, flow.folder, flow.trigger_app, flow.description, flow.owner, flow.tags, flow.notes, req.user.id, req.user.id],
    );
    await insertTree(conn, result.insertId, steps);
    await logActivity(req, { action: 'create', entity: 'flow', entityId: result.insertId, flowId: result.insertId, summary: `Duplicated "${flow.name}" as "${name}"` }, conn);
    return result.insertId;
  });
  res.status(201).json({ flow: await loadFlow(newId) });
});

// POST /api/flows/:id/steps  { kind, parent_id?, after_id?, title, app, event, condition, description, notes }
router.post('/:id/steps', canEdit, async (req, res) => {
  const flowId = toId(req.params.id);
  const flow = await loadFlow(flowId);
  const body = req.body || {};
  const kind = oneOf(body.kind, STEP_KINDS, 'Step type');
  const fields = stepFields(body);

  const step = await transaction(async (conn) => {
    let parent = null;
    if (body.parent_id) {
      const [rows] = await conn.query('SELECT id, kind FROM steps WHERE id = ? AND flow_id = ?', [toId(body.parent_id, 'parent_id'), flowId]);
      parent = rows[0];
      if (!parent) throw badRequest('Parent step not found in this flow');
    }
    const err = placementError(parent?.kind, kind);
    if (err) throw badRequest(err);
    if (kind === 'trigger') {
      const [t] = await conn.query("SELECT id FROM steps WHERE flow_id = ? AND kind = 'trigger'", [flowId]);
      if (t.length) throw badRequest('This flow already has a trigger');
    }

    const parentId = parent?.id ?? null;
    const siblings = await normalizeSiblings(conn, flowId, parentId);
    let position = siblings.length;
    if (kind === 'trigger') position = -1;
    else if (body.after_id) {
      const afterId = toId(body.after_id, 'after_id');
      const after = siblings.find((s) => s.id === afterId);
      if (!after) throw badRequest('after_id must be a step at the same level');
      position = after.position + 1;
      await conn.query('UPDATE steps SET position = position + 1 WHERE flow_id = ? AND parent_id <=> ? AND position >= ?', [flowId, parentId, position]);
    }

    const [result] = await conn.query(
      `INSERT INTO steps (flow_id, parent_id, position, kind, title, app, event, condition_text, description, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [flowId, parentId, position, kind, fields.title, fields.app, fields.event, fields.condition_text, fields.description, fields.notes],
    );
    if (kind === 'trigger') await normalizeSiblings(conn, flowId, null);
    await touchFlow(flowId, req.user.id, conn);
    const created = { id: result.insertId, kind, ...fields };
    await logActivity(req, { action: 'create', entity: 'step', entityId: created.id, flowId, summary: `Added ${kind} "${stepLabel(created)}" to "${flow.name}"` }, conn);
    const [rows] = await conn.query('SELECT * FROM steps WHERE id = ?', [result.insertId]);
    return rows[0];
  });
  res.status(201).json({ step });
});

export default router;
