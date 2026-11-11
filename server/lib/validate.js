import { badRequest } from './http.js';

export const ROLES = ['admin', 'editor', 'viewer'];
export const FLOW_STATUSES = ['active', 'inactive', 'draft'];
export const STEP_KINDS = ['trigger', 'action', 'router', 'route', 'filter', 'delay', 'formatter', 'iterator', 'code', 'api', 'other'];

/** Optional trimmed string; '' becomes null. Throws if longer than max. */
export function optStr(value, label, max) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s.length > max) throw badRequest(`${label} must be at most ${max} characters`);
  return s;
}

export function reqStr(value, label, max) {
  const s = optStr(value, label, max);
  if (!s) throw badRequest(`${label} is required`);
  return s;
}

export function oneOf(value, allowed, label, fallback) {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw badRequest(`${label} is required`);
  }
  const v = String(value).trim().toLowerCase();
  if (!allowed.includes(v)) throw badRequest(`${label} must be one of: ${allowed.join(', ')}`);
  return v;
}

/** Only http(s) links are stored, so nothing like javascript: can end up in an href. */
export function optUrl(value, label) {
  const s = optStr(value, label, 1000);
  if (!s) return null;
  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    throw badRequest(`${label} must be a full URL starting with https://`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw badRequest(`${label} must start with http:// or https://`);
  }
  return s;
}

/** Accepts "a, b ,c" or ["a","b"]; stores a clean comma-separated string. */
export function normalizeTags(value) {
  if (value === undefined || value === null) return null;
  const list = (Array.isArray(value) ? value : String(value).split(','))
    .map((t) => String(t).trim())
    .filter(Boolean);
  const unique = [...new Set(list.map((t) => t.toLowerCase()))].map((lower) => list.find((t) => t.toLowerCase() === lower));
  const joined = unique.join(', ');
  if (joined.length > 500) throw badRequest('Tags are too long (max 500 characters in total)');
  return joined || null;
}

export function email(value) {
  const s = reqStr(value, 'Email', 190).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw badRequest('Enter a valid email address');
  return s;
}
