import crypto from 'node:crypto';
import { config } from '../config.js';

export function generateCode() {
  const max = 10 ** config.otp.length;
  return String(crypto.randomInt(0, max)).padStart(config.otp.length, '0');
}

/** Codes are stored only as an HMAC, tied to the user, so a database leak reveals nothing usable. */
export function hashCode(userId, code) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${userId}:${code}`).digest('hex');
}

export function codeMatches(userId, code, storedHash) {
  const a = Buffer.from(hashCode(userId, code), 'hex');
  const b = Buffer.from(String(storedHash), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Accepts "123 456", "123-456" etc. Returns the digits or null. */
export function normalizeCode(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === config.otp.length ? digits : null;
}
