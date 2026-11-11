import { badRequest } from './http.js';
import { STEP_KINDS, optStr, oneOf } from './validate.js';

/**
 * Structure rules (mirrors how Pabbly builds workflows):
 *  - top level: trigger (max one, always first), actions, routers, filters, ...
 *  - a router contains only routes
 *  - a route contains any step except a trigger or another route (it can contain routers)
 *  - every other step type is a leaf
 */
export function placementError(parentKind, kind) {
  if (!parentKind) {
    return kind === 'route' ? 'A route must be inside a router' : null;
  }
  if (parentKind === 'router') {
    return kind === 'route' ? null : 'A router can only contain routes';
  }
  if (parentKind === 'route') {
    if (kind === 'route') return 'A route must be directly inside a router';
    if (kind === 'trigger') return 'The trigger must be the first top-level step';
    return null;
  }
  return 'Only routers and routes can contain steps';
}

export function childrenError(kind, childKinds) {
  if (!childKinds.length) return null;
  if (kind === 'router') {
    return childKinds.every((k) => k === 'route') ? null : 'A router can only contain routes';
  }
  if (kind === 'route') {
    return childKinds.some((k) => k === 'route') ? 'A route cannot contain routes directly' : null;
  }
  return 'This step has steps inside it, so it must stay a router or route';
}

/** Validated, trimmed step fields. With partial=true only keys present in body are returned. */
export function stepFields(body, partial = false) {
  const out = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has('title')) out.title = optStr(body.title, 'Title', 255);
  if (has('app')) out.app = optStr(body.app, 'App', 120);
  if (has('event')) out.event = optStr(body.event, 'Event / action', 255);
  const cond = body.condition_text !== undefined ? body.condition_text : body.condition;
  if (!partial || cond !== undefined) out.condition_text = optStr(cond, 'Condition', 10000);
  if (has('description')) out.description = optStr(body.description, 'Description', 10000);
  if (has('notes')) out.notes = optStr(body.notes, 'Notes', 10000);
  return out;
}

export function sortSteps(list) {
  return list.sort((a, b) => a.position - b.position || a.id - b.id);
}

/** Flat rows → nested tree (children arrays), ordered by position. */
export function buildTree(rows) {
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortDeep = (list) => {
    sortSteps(list);
    list.forEach((n) => sortDeep(n.children));
  };
  sortDeep(roots);
  return roots;
}

/** Map of step id → display number like "4", "4.2", "4.2.1" (same scheme as the UI). */
export function numberSteps(rows) {
  const numbers = new Map();
  const walk = (nodes, prefix) => {
    nodes.forEach((n, i) => {
      const num = prefix ? `${prefix}.${i + 1}` : String(i + 1);
      numbers.set(n.id, num);
      walk(n.children, num);
    });
  };
  walk(buildTree(rows), '');
  return numbers;
}

export function stepLabel(s) {
  if (s.title) return s.title;
  const parts = [s.app, s.event].filter(Boolean);
  return parts.length ? parts.join(' — ') : s.kind;
}

/** Collects id plus every descendant id. */
export function descendantIds(rows, id) {
  const children = new Map();
  for (const r of rows) {
    if (!r.parent_id) continue;
    if (!children.has(r.parent_id)) children.set(r.parent_id, []);
    children.get(r.parent_id).push(r.id);
  }
  const out = [id];
  for (let i = 0; i < out.length; i++) out.push(...(children.get(out[i]) || []));
  return out;
}

/** Rewrites sibling positions to 0..n-1 (keeps current order). Returns ordered sibling rows. */
export async function normalizeSiblings(conn, flowId, parentId) {
  const [rows] = await conn.query(
    'SELECT id, kind, position FROM steps WHERE flow_id = ? AND parent_id <=> ? ORDER BY position ASC, id ASC',
    [flowId, parentId],
  );
  // Trigger always stays first at the top level.
  if (!parentId) rows.sort((a, b) => (a.kind === 'trigger' ? -1 : 0) - (b.kind === 'trigger' ? -1 : 0));
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].position !== i) {
      await conn.query('UPDATE steps SET position = ? WHERE id = ?', [i, rows[i].id]);
      rows[i].position = i;
    }
  }
  return rows;
}

/**
 * Inserts a nested step tree (from import, duplicate or JSON restore) under parentId.
 * nodes: [{ kind, title, app, event, condition, description, notes, children: [...] }]
 * Throws a 400 describing the first invalid step. Returns number of steps inserted.
 */
export async function insertTree(conn, flowId, nodes, parentId = null, parentKind = null, state = { triggers: 0, count: 0 }, prefix = '') {
  if (nodes === undefined || nodes === null) return state.count;
  if (!Array.isArray(nodes)) throw badRequest('steps must be a list');
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i] || {};
    const where = `step ${prefix ? `${prefix}.` : ''}${i + 1}`;
    let kind;
    try {
      kind = oneOf(node.kind, STEP_KINDS, 'Step type');
    } catch (e) {
      throw badRequest(`${where}: ${e.message}`);
    }
    const err = placementError(parentKind, kind);
    if (err) throw badRequest(`${where}: ${err}`);
    if (kind === 'trigger' && ++state.triggers > 1) throw badRequest(`${where}: a flow can only have one trigger`);

    let fields;
    try {
      fields = stepFields(node);
    } catch (e) {
      throw badRequest(`${where}: ${e.message}`);
    }
    const [result] = await conn.query(
      `INSERT INTO steps (flow_id, parent_id, position, kind, title, app, event, condition_text, description, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [flowId, parentId, kind === 'trigger' ? -1 : i, kind, fields.title, fields.app, fields.event, fields.condition_text, fields.description, fields.notes],
    );
    state.count++;
    const children = node.children ?? node.steps;
    if (children !== undefined && children !== null && (!Array.isArray(children) || children.length)) {
      if (kind !== 'router' && kind !== 'route') throw badRequest(`${where}: only routers and routes can contain steps`);
      await insertTree(conn, flowId, children, result.insertId, kind, state, `${prefix ? `${prefix}.` : ''}${i + 1}`);
    }
  }
  if (!parentId) await normalizeSiblings(conn, flowId, null);
  return state.count;
}

/** Tree → portable JSON (no database ids). */
export function exportTree(nodes) {
  return nodes.map((n) => {
    const out = { kind: n.kind };
    for (const key of ['title', 'app', 'event', 'description', 'notes']) if (n[key]) out[key] = n[key];
    if (n.condition_text) out.condition = n.condition_text;
    if (n.children.length) out.children = exportTree(n.children);
    return out;
  });
}
