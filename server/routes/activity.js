import { Router } from 'express';
import { query } from '../db.js';
import { toId } from '../lib/http.js';

const router = Router();

// GET /api/activity?flow_id=&limit=50&before_id=
router.get('/', async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.flow_id) {
    where.push('a.flow_id = ?');
    params.push(toId(req.query.flow_id, 'flow_id'));
  }
  if (req.query.before_id) {
    where.push('a.id < ?');
    params.push(toId(req.query.before_id, 'before_id'));
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const rows = await query(
    `SELECT a.*, f.name AS flow_name
       FROM activity a LEFT JOIN flows f ON f.id = a.flow_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.id DESC
      LIMIT ${limit}`,
    params,
  );
  res.json({ activity: rows, has_more: rows.length === limit });
});

export default router;
