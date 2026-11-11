import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne } from '../db.js';
import { badRequest, notFound, toId } from '../lib/http.js';
import { adminOnly, publicUser } from '../lib/auth.js';
import { ROLES, email as validEmail, oneOf, password as validPassword, reqStr } from '../lib/validate.js';
import { logActivity } from '../lib/activity.js';

const router = Router();
router.use(adminOnly);

router.get('/', async (_req, res) => {
  const users = await query('SELECT * FROM users ORDER BY is_active DESC, name ASC');
  res.json({ users: users.map(publicUser) });
});

router.post('/', async (req, res) => {
  const name = reqStr(req.body?.name, 'Name', 120);
  const email = validEmail(req.body?.email);
  const role = oneOf(req.body?.role, ROLES, 'Role', 'viewer');
  const pwd = validPassword(req.body?.password);

  if (await queryOne('SELECT id FROM users WHERE email = ?', [email])) {
    throw badRequest('A user with this email already exists');
  }
  const hash = await bcrypt.hash(pwd, 12);
  const result = await query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, hash, role]);
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [result.insertId]);
  await logActivity(req, { action: 'create', entity: 'user', entityId: user.id, summary: `Added user ${email} as ${role}` });
  res.status(201).json({ user: publicUser(user) });
});

async function activeAdminCount() {
  const row = await queryOne("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1");
  return Number(row.n);
}

router.patch('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) throw notFound('User not found');

  const updates = {};
  const changes = [];
  let logout = false;

  if (req.body?.name !== undefined) {
    updates.name = reqStr(req.body.name, 'Name', 120);
  }
  if (req.body?.role !== undefined) {
    updates.role = oneOf(req.body.role, ROLES, 'Role');
    if (updates.role !== user.role) changes.push(`role ${user.role} → ${updates.role}`);
  }
  if (req.body?.is_active !== undefined) {
    updates.is_active = req.body.is_active ? 1 : 0;
    if (updates.is_active !== user.is_active) {
      changes.push(updates.is_active ? 'reactivated' : 'deactivated');
      if (!updates.is_active) logout = true;
    }
  }
  if (req.body?.password !== undefined && req.body.password !== '') {
    const hash = await bcrypt.hash(validPassword(req.body.password), 12);
    updates.password_hash = hash;
    changes.push('password reset');
    logout = true;
  }

  // Never leave the system without an active admin.
  const losingAdmin =
    user.role === 'admin' && user.is_active &&
    ((updates.role && updates.role !== 'admin') || updates.is_active === 0);
  if (losingAdmin && (await activeAdminCount()) <= 1) {
    throw badRequest('This is the only active admin. Make someone else an admin first.');
  }
  if (id === req.user.id && (updates.is_active === 0 || (updates.role && updates.role !== 'admin'))) {
    throw badRequest('You cannot deactivate or demote your own account');
  }

  const keys = Object.keys(updates);
  if (!keys.length) throw badRequest('Nothing to update');
  const sets = keys.map((k) => `${k} = ?`);
  if (logout) sets.push('token_version = token_version + 1');
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...keys.map((k) => updates[k]), id]);

  const updated = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
  if (changes.length) {
    await logActivity(req, { action: 'update', entity: 'user', entityId: id, summary: `User ${user.email}: ${changes.join(', ')}` });
  }
  res.json({ user: publicUser(updated) });
});

export default router;
