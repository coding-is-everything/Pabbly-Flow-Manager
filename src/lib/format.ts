import type { Step } from './types';

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} d ago`;
  return formatDate(iso);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function splitTags(tags: string | null | undefined): string[] {
  return (tags || '').split(',').map((t) => t.trim()).filter(Boolean);
}

/** Only http(s) links are ever rendered as clickable. */
export function isHttpUrl(value: string | null | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

export function stepLabel(s: Pick<Step, 'title' | 'app' | 'event' | 'kind'>): string {
  if (s.title) return s.title;
  const parts = [s.app, s.event].filter(Boolean);
  return parts.length ? parts.join(' — ') : s.kind;
}

export function countSteps(nodes: Step[]): { steps: number; routers: number } {
  let steps = 0;
  let routers = 0;
  const walk = (list: Step[]) => {
    for (const n of list) {
      steps++;
      if (n.kind === 'router') routers++;
      walk(n.children);
    }
  };
  walk(nodes);
  return { steps, routers };
}

export function collectIds(nodes: Step[], predicate: (s: Step) => boolean): number[] {
  const out: number[] = [];
  const walk = (list: Step[]) => {
    for (const n of list) {
      if (predicate(n)) out.push(n.id);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
