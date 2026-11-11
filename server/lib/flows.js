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

/**
 * "Documentation gaps": flows whose record is incomplete. Each sql is a WHERE condition on
 * flows aliased as f. Used by the dashboard and by GET /api/flows?gap=<key>.
 */
export const GAPS = {
  no_steps: {
    label: 'No steps documented',
    hint: 'Open the flow and add its trigger and steps',
    sql: 'NOT EXISTS (SELECT 1 FROM steps s WHERE s.flow_id = f.id)',
  },
  no_link: {
    label: 'Missing Pabbly link',
    hint: 'Paste the workflow URL so people can jump straight to it',
    sql: 'f.pabbly_url IS NULL',
  },
  no_owner: {
    label: 'No owner',
    hint: 'Say who to ask when this flow breaks',
    sql: 'f.owner IS NULL',
  },
  no_webhook: {
    label: 'Webhook trigger without webhook URL',
    hint: 'The trigger is a webhook but its URL is not recorded',
    sql: `f.webhook_url IS NULL AND (f.trigger_app LIKE '%webhook%'
          OR EXISTS (SELECT 1 FROM steps s WHERE s.flow_id = f.id AND s.kind = 'trigger' AND s.app LIKE '%webhook%'))`,
  },
  empty_branch: {
    label: 'Empty routers or routes',
    hint: 'A router with no routes, or a route with no steps',
    sql: `EXISTS (SELECT 1 FROM steps s WHERE s.flow_id = f.id AND s.kind IN ('router', 'route')
          AND NOT EXISTS (SELECT 1 FROM steps c WHERE c.parent_id = s.id))`,
  },
};

/** A flow counts as fully documented when it has steps, a Pabbly link and an owner. */
export const DOCUMENTED_SQL = `NOT (${GAPS.no_steps.sql}) AND f.pabbly_url IS NOT NULL AND f.owner IS NOT NULL`;
