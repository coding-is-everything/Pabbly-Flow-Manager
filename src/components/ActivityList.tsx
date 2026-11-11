import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import type { Activity } from '../lib/types';
import { formatDateTime, timeAgo } from '../lib/format';
import { cx } from './ui';

const ICONS = {
  create: { icon: Plus, cls: 'bg-emerald-100 text-emerald-700' },
  update: { icon: Pencil, cls: 'bg-sky-100 text-sky-700' },
  delete: { icon: Trash2, cls: 'bg-rose-100 text-rose-700' },
  import: { icon: Upload, cls: 'bg-violet-100 text-violet-700' },
};

export default function ActivityList({ items, showFlow = true }: { items: Activity[]; showFlow?: boolean }) {
  if (!items.length) return <p className="px-5 py-6 text-sm text-slate-500">No activity yet.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((a) => {
        const meta = ICONS[a.action] ?? ICONS.update;
        const Icon = meta.icon;
        return (
          <li key={a.id} className="flex gap-3 px-4 py-3 sm:px-5">
            <div className={cx('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full', meta.cls)}>
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-slate-800">{a.summary}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                <span className="font-medium text-slate-600">{a.user_name || 'System'}</span>
                {' · '}
                <time title={formatDateTime(a.created_at)}>{timeAgo(a.created_at)}</time>
                {showFlow && a.flow_id && a.flow_name && (
                  <>
                    {' · '}
                    <Link to={`/flows/${a.flow_id}`} className="text-indigo-600 hover:underline">
                      Open flow
                    </Link>
                  </>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
