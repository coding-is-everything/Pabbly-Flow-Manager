import { FLOW_STATUSES, normalizeTags, optStr, optUrl, oneOf, reqStr } from './validate.js';

const STATUS_ALIASES = {
  on: 'active', enabled: 'active', live: 'active', yes: 'active', true: 'active', running: 'active',
  off: 'inactive', disabled: 'inactive', paused: 'inactive', no: 'inactive', false: 'inactive', stopped: 'inactive',
};

export function normalizeStatus(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const v = String(value).trim().toLowerCase();
  return oneOf(STATUS_ALIASES[v] || v, FLOW_STATUSES, 'Status');
}

export const FLOW_FIELD_LABELS = {
  name: 'name', folder: 'folder', status: 'status', pabbly_url: 'Pabbly URL', webhook_url: 'webhook URL',
  trigger_app: 'trigger app', description: 'purpose', owner: 'owner', tags: 'tags', notes: 'notes',
};

/** Validated flow fields. With partial=true only keys present in body are returned. */
export function flowFields(body, partial = false) {
  const out = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has('name')) out.name = reqStr(body.name, 'Flow name', 255);
  if (has('folder')) out.folder = optStr(body.folder, 'Folder', 120);
  if (has('status')) out.status = normalizeStatus(body.status, 'active');
  if (has('pabbly_url')) out.pabbly_url = optUrl(body.pabbly_url, 'Pabbly workflow URL');
  if (has('webhook_url')) out.webhook_url = optUrl(body.webhook_url, 'Webhook URL');
  if (has('trigger_app')) out.trigger_app = optStr(body.trigger_app, 'Trigger app', 120);
  if (has('description')) out.description = optStr(body.description, 'Purpose', 10000);
  if (has('owner')) out.owner = optStr(body.owner, 'Owner', 120);
  if (has('tags')) out.tags = normalizeTags(body.tags);
  if (has('notes')) out.notes = optStr(body.notes, 'Notes', 10000);
  return out;
}

export const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);
