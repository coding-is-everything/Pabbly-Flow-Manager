import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { query, queryOne } from '../db.js';
import { HttpError, badRequest } from '../lib/http.js';
import { requireAuth, setSessionCookie, clearSessionCookie, publicUser } from '../lib/auth.js';
import { password as validPassword } from '../lib/validate.js';

const router = Router();

// Slows down password guessing: 20 failed attempts per 15 minutes per IP.
// Successful logins are not counted, so a whole office behind one IP is not locked out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
});

// A dummy hash (of a random throwaway string) so a wrong email takes as long as a wrong password.
const DUMMY_HASH = '$2b$12$1bVKeMOm9GfWa9mL3rgGpepRsXsYtk1p4Fe.EgZbFXcFuxBhr57aG';

router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw badRequest('Email and password are required');

  const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
  const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Incorrect email or password');
  if (!user.is_active) throw new HttpError(403, 'This account has been deactivated. Ask an admin to re-enable it.');

  await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  setSessionCookie(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const current = String(req.body?.current_password || '');
  const next = validPassword(req.body?.new_password, 'New password');
  const ok = await bcrypt.compare(current, req.user.password_hash);
  if (!ok) throw badRequest('Current password is incorrect');

  const hash = await bcrypt.hash(next, 12);
  await query('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hash, req.user.id]);
  // Other devices are logged out; this one gets a fresh session.
  const updated = await queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
  setSessionCookie(res, updated);
  res.json({ ok: true });
});

export default router;
