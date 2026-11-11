import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { queryOne } from '../db.js';
import { HttpError, forbidden } from './http.js';

const maxAgeMs = () => config.sessionDays * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
  };
}

export function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    is_active: !!u.is_active,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
  };
}

export function setSessionCookie(res, user) {
  const token = jwt.sign({ sub: user.id, tv: user.token_version }, config.jwtSecret, {
    expiresIn: `${config.sessionDays}d`,
  });
  res.cookie(config.cookieName, token, { ...cookieOptions(), maxAge: maxAgeMs() });
}

export function clearSessionCookie(res) {
  res.clearCookie(config.cookieName, cookieOptions());
}

/** Loads the logged-in user from the session cookie, or responds 401. */
export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) throw new HttpError(401, 'Please log in');
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired — please log in again');
  }
  const user = await queryOne('SELECT * FROM users WHERE id = ?', [payload.sub]);
  // token_version changes on password change / deactivation, which logs out old sessions.
  if (!user || !user.is_active || user.token_version !== payload.tv) {
    throw new HttpError(401, 'Your session has expired — please log in again');
  }
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) throw forbidden();
  next();
};

export const canEdit = requireRole('admin', 'editor');
export const adminOnly = requireRole('admin');
