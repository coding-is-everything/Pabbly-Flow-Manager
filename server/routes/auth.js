import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { query, queryOne } from '../db.js';
import { HttpError, badRequest } from '../lib/http.js';
import { requireAuth, setSessionCookie, clearSessionCookie, publicUser } from '../lib/auth.js';
import { email as validEmail } from '../lib/validate.js';
import { codeMatches, generateCode, hashCode, normalizeCode } from '../lib/otp.js';
import { sendOtpEmail } from '../lib/mailer.js';

const router = Router();
const { otp } = config;

// Per-IP limits. Counted per network, so they are generous enough for an office behind one IP.
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many code requests from this network. Please wait 15 minutes and try again.' },
});
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true, // only wrong codes count
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many wrong codes from this network. Please wait 15 minutes and try again.' },
});

/**
 * POST /api/auth/request-otp  { email }
 * Emails a 6-digit code. The reply is the same whether or not the email has an account,
 * so the login page cannot be used to discover who has access.
 */
router.post('/request-otp', requestLimiter, async (req, res) => {
  const email = validEmail(req.body?.email);
  const reply = (resendAfter = otp.resendSeconds) =>
    res.json({
      ok: true,
      message: `If ${email} has access, a ${otp.length}-digit code is on its way. It expires in ${otp.ttlMinutes} minutes.`,
      resend_after: resendAfter,
    });

  // Housekeeping: drop codes older than a day.
  await query('DELETE FROM login_otps WHERE created_at < CURRENT_TIMESTAMP - INTERVAL 1 DAY');

  const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !user.is_active) return reply();

  // The cooldown only applies while an unused code is still pending; if the last code was
  // already used (or locked after wrong tries) a fresh one is sent straight away.
  const recent = await queryOne(
    `SELECT COUNT(*) AS last_hour,
            MIN(CASE WHEN consumed_at IS NULL THEN TIMESTAMPDIFF(SECOND, created_at, CURRENT_TIMESTAMP) END) AS seconds_since_pending
       FROM login_otps
      WHERE user_id = ? AND created_at > CURRENT_TIMESTAMP - INTERVAL 1 HOUR`,
    [user.id],
  );
  const sincePending = recent.seconds_since_pending === null ? null : Number(recent.seconds_since_pending);
  if (sincePending !== null && sincePending < otp.resendSeconds) {
    // A code was sent moments ago and is still unused: don't send another, just say how long to wait.
    return reply(otp.resendSeconds - sincePending);
  }
  if (Number(recent.last_hour) >= otp.maxPerHour) {
    throw new HttpError(429, 'Too many codes requested for this email. Please try again in an hour.');
  }

  // Only the newest code works.
  await query('UPDATE login_otps SET consumed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND consumed_at IS NULL', [user.id]);

  const code = generateCode();
  const result = await query(
    'INSERT INTO login_otps (user_id, code_hash, expires_at, ip) VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL ? MINUTE, ?)',
    [user.id, hashCode(user.id, code), otp.ttlMinutes, String(req.ip || '').slice(0, 64)],
  );

  try {
    await sendOtpEmail(user, code);
  } catch (err) {
    console.error('Sending login code failed:', err.message);
    await query('DELETE FROM login_otps WHERE id = ?', [result.insertId]);
    throw new HttpError(502, 'We could not send the email right now. Please try again in a minute, or ask an admin to check the email settings.');
  }
  reply();
});

/** POST /api/auth/verify-otp  { email, code } → sets the session cookie */
router.post('/verify-otp', verifyLimiter, async (req, res) => {
  const email = validEmail(req.body?.email);
  const code = normalizeCode(req.body?.code);
  if (!code) throw badRequest(`Enter the ${otp.length}-digit code from the email`);

  const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
  const row = user
    ? await queryOne(
        `SELECT id, code_hash, attempts, (expires_at > CURRENT_TIMESTAMP) AS still_valid
           FROM login_otps
          WHERE user_id = ? AND consumed_at IS NULL
          ORDER BY id DESC LIMIT 1`,
        [user.id],
      )
    : null;

  if (!user || !user.is_active || !row || !Number(row.still_valid)) {
    throw new HttpError(401, 'This code is wrong or has expired. Request a new code.');
  }
  if (row.attempts >= otp.maxAttempts) {
    throw new HttpError(401, 'Too many wrong attempts for this code. Request a new code.');
  }

  if (!codeMatches(user.id, code, row.code_hash)) {
    await query('UPDATE login_otps SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    const left = otp.maxAttempts - row.attempts - 1;
    if (left <= 0) {
      await query('UPDATE login_otps SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
      throw new HttpError(401, 'Too many wrong attempts for this code. Request a new code.');
    }
    throw new HttpError(401, `That code is not correct. ${left} attempt${left === 1 ? '' : 's'} left.`);
  }

  // Mark used; the condition makes a code single-use even if two requests race.
  const used = await query('UPDATE login_otps SET consumed_at = CURRENT_TIMESTAMP WHERE id = ? AND consumed_at IS NULL', [row.id]);
  if (used.affectedRows !== 1) throw new HttpError(401, 'This code was already used. Request a new code.');

  await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  setSessionCookie(res, user);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** Ends every session of the current user on every device. */
router.post('/logout-all', requireAuth, async (req, res) => {
  await query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [req.user.id]);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
