import { Router } from 'express';
import { queryOne, transaction } from '../db.js';
import { badRequest, notFound, toId } from '../lib/http.js';
import { canEdit } from '../lib/auth.js';
import { STEP_KINDS, oneOf } from '../lib/validate.js';
import { childrenError, descendantIds, normalizeSiblings, placementError, stepFields, stepLabel } from '../lib/steps.js';
import { logActivity, touchFlow } from '../lib/activity.js';

const router = Router();
router.use(canEdit);

async function loadStep(id) {
  const step = await queryOne(
    `SELECT s.*, p.kind AS parent_kind, f.name AS flow_name
       FROM steps s
       JOIN flows f ON f.id = s.flow_id
       LEFT JOIN steps p ON p.id = s.parent_id
      WHERE s.id = ?`,
    [id],
  );
  if (!step) throw notFound('Step not found');
  return step;
}

// PATCH /api/steps/:id  { kind?, title?, app?, event?, condition?, description?, notes? }
router.patch('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const step = await loadStep(id);
  const body = req.body || {};
  const fields = stepFields(body, true);

  const updated = await transaction(async (conn) => {
    if (body.kind !== undefined) {
      const kind = oneOf(body.kind, STEP_KINDS, 'Step type');
      if (kind !== step.kind) {
        const placeErr = placementError(step.parent_kind, kind);
        if (placeErr) throw badRequest(placeErr);
        const [kids] = await conn.query('SELECT kind FROM steps WHERE parent_id = ?', [id]);
        const kidErr = childrenError(kind, kids.map((k) => k.kind));
        if (kidErr) throw badRequest(kidErr);
        if (kind === 'trigger') {
          const [t] = await conn.query("SELECT id FROM steps WHERE flow_id = ? AND kind = 'trigger' AND id <> ?", [step.flow_id, id]);
          if (t.length) throw badRequest('This flow already has a trigger');
        }
        fields.kind = kind;
      }
    }
    const keys = Object.keys(fields);
    if (!keys.length) throw badRequest('Nothing to update');
    await conn.query(`UPDATE steps SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => fields[k]), id]);
    if (fields.kind === 'trigger') await normalizeSiblings(conn, step.flow_id, null);
    await touchFlow(step.flow_id, req.user.id, conn);

    const [rows] = await conn.query('SELECT * FROM steps WHERE id = ?', [id]);
    await logActivity(req, {
      action: 'update', entity: 'step', entityId: id, flowId: step.flow_id,
      summary: `Edited ${rows[0].kind} "${stepLabel(rows[0])}" in "${step.flow_name}"`,
    }, conn);
    return rows[0];
  });
  res.json({ step: updated });
});

// DELETE /api/steps/:id — also deletes everything inside it (routes and their steps)
router.delete('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const step = await loadStep(id);
  const removed = await transaction(async (conn) => {
    const [all] = await conn.query('SELECT id, parent_id FROM steps WHERE flow_id = ?', [step.flow_id]);
    const ids = descendantIds(all, id);
    await conn.query('UPDATE steps SET parent_id = NULL WHERE id IN (?)', [ids]);
    await conn.query('DELETE FROM steps WHERE id IN (?)', [ids]);
    await normalizeSiblings(conn, step.flow_id, step.parent_id);
    await touchFlow(step.flow_id, req.user.id, conn);
    const inside = ids.length - 1;
    await logActivity(req, {
      action: 'delete', entity: 'step', entityId: id, flowId: step.flow_id,
      summary: `Deleted ${step.kind} "${stepLabel(step)}"${inside ? ` and ${inside} step(s) inside it` : ''} from "${step.flow_name}"`,
    }, conn);
    return ids.length;
  });
  res.json({ ok: true, removed });
});

// POST /api/steps/:id/move  { direction: "up" | "down" }
router.post('/:id/move', async (req, res) => {
  const id = toId(req.params.id);
  const direction = oneOf(req.body?.direction, ['up', 'down'], 'direction');
  const step = await loadStep(id);
  if (step.kind === 'trigger') throw badRequest('The trigger always stays first');

  await transaction(async (conn) => {
    const siblings = await normalizeSiblings(conn, step.flow_id, step.parent_id);
    const index = siblings.findIndex((s) => s.id === id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= siblings.length) throw badRequest(`Step is already ${direction === 'up' ? 'first' : 'last'}`);
    if (siblings[target].kind === 'trigger') throw badRequest('Steps cannot move above the trigger');
    await conn.query('UPDATE steps SET position = ? WHERE id = ?', [target, id]);
    await conn.query('UPDATE steps SET position = ? WHERE id = ?', [index, siblings[target].id]);
    await touchFlow(step.flow_id, req.user.id, conn);
  });
  res.json({ ok: true });
});

export default router;
