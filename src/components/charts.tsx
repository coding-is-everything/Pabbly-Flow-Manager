import { Link } from 'react-router-dom';
import { cx } from './ui';

/* Small, dependency-free chart pieces for the dashboard. */

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** block colour (hex) */
  color: string;
  /** text colour inside the block — white or near-black for contrast */
  ink: string;
  to?: string;
}

/**
 * Tall segmented bar: one whole split into parts (e.g. flows by status).
 * Each block shows its share when wide enough; hover / focus / the accessible name give
 * every part's name, amount and share. The legend lists the names in block order.
 */
export function SegmentedBar({ segments, unit }: { segments: Segment[]; unit: string }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const parts = segments.filter((s) => s.value > 0);
  const describe = (s: Segment) => `${s.label}: ${s.value} ${unit}${s.value === 1 ? '' : 's'} (${Math.round((s.value / total) * 100)}%)`;

  return (
    <div>
      <div className="flex h-7 gap-0.5" role="img" aria-label={total ? parts.map(describe).join(', ') : `No ${unit}s`}>
        {total === 0 && <div className="h-full w-full rounded bg-slate-100" />}
        {parts.map((s) => {
          const share = (s.value / total) * 100;
          const block = (
            <div
              className="flex h-full items-center rounded px-2 text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: s.color, color: s.ink }}
              title={describe(s)}
            >
              {share >= 12 ? `${Math.round(share)}%` : ''}
            </div>
          );
          return (
            <div key={s.key} style={{ width: `${share}%` }} className="min-w-[6px]">
              {s.to ? (
                <Link to={s.to} aria-label={describe(s)} className="block h-full rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                  {block}
                </Link>
              ) : (
                block
              )}
            </div>
          );
        })}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Meter: one ratio against its whole. The track is a lighter step of the fill's ramp. */
export function Meter({ value, max, tone }: { value: number; max: number; tone: 'good' | 'warning' | 'danger' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const tones = {
    good: { track: 'bg-indigo-100', fill: 'bg-indigo-600' },
    warning: { track: 'bg-amber-100', fill: 'bg-amber-500' },
    danger: { track: 'bg-rose-100', fill: 'bg-rose-500' },
  }[tone];
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full', tones.track)} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', tones.fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Ranked bar list (meter list): name and figure on one row, bar underneath.
 * One hue for every bar — the ranking, not colour, carries the meaning.
 */
export function BarList({ rows, unit }: { rows: { key: string; label: string; value: number; to?: string; muted?: boolean }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const title = `${r.label}: ${r.value} ${unit}${r.value === 1 ? '' : 's'}`;
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={cx('truncate', r.muted ? 'italic text-slate-500' : 'text-slate-700 group-hover:text-indigo-700')}>{r.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-slate-900">{r.value}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div
                className={cx('h-2 rounded-full transition-colors', r.muted ? 'bg-slate-300' : 'bg-indigo-500 group-hover:bg-indigo-600')}
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {r.to ? (
              <Link to={r.to} title={title} className="group block rounded-md px-2 py-1.5 hover:bg-slate-50">{inner}</Link>
            ) : (
              <div title={title} className="group px-2 py-1.5">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
