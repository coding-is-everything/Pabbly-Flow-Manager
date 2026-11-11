import { query } from '../db.js';

/**
 * Records who did what. Never fails the request: a logging error is printed and ignored.
 * runner can be a transaction connection so the entry commits together with the change.
 */
export async function logActivity(req, { action, entity, entityId = null, flowId = null, summary }, runner = null) {
  const sql =
    'INSERT INTO activity (user_id, user_name, action, entity, entity_id, flow_id, summary) VALUES (?, ?, ?, ?, ?, ?, ?)';
  const params = [req.user?.id ?? null, req.user?.name ?? null, action, entity, entityId, flowId, String(summary).slice(0, 500)];
  try {
    if (runner) await runner.query(sql, params);
    else await query(sql, params);
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

/** Marks a flow as changed by this user (used when its steps change). */
export async function touchFlow(flowId, userId, runner = null) {
  const sql = 'UPDATE flows SET updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  if (runner) await runner.query(sql, [userId, flowId]);
  else await query(sql, [userId, flowId]);
}
