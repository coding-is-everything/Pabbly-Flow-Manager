import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleCheck, CircleOff, FilePen, GitFork, ListTree, Plus, Upload, Workflow, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMeta } from '../lib/meta';
import type { Activity } from '../lib/types';
import ActivityList from '../components/ActivityList';
import FlowFormModal from '../components/FlowFormModal';
import { Button, Card, EmptyState, PageLoader, cx } from '../components/ui';

function Stat({ label, value, icon: Icon, to, tone }: { label: string; value: number; icon: LucideIcon; to: string; tone: string }) {
  return (
    <Link to={to} className="group rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:ring-indigo-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className={cx('flex size-8 items-center justify-center rounded-lg', tone)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value.toLocaleString('en-IN')}</div>
    </Link>
  );
}

export default function DashboardPage() {
  const { meta, reloadMeta } = useMeta();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    reloadMeta();
    api<{ activity: Activity[] }>('/activity?limit=8').then((d) => setActivity(d.activity)).catch(() => setActivity([]));
  }, [reloadMeta]);

  if (!meta) return <PageLoader />;
  const { counts } = meta;
  const maxFolder = Math.max(1, ...meta.folders.map((f) => f.count), meta.unfiled);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">Overview of every Pabbly Connect flow your team runs.</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={Upload} onClick={() => navigate('/import')}>Import CSV</Button>
            <Button icon={Plus} onClick={() => setCreating(true)}>New flow</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total flows" value={counts.flows} icon={Workflow} to="/flows" tone="bg-indigo-50 text-indigo-600" />
        <Stat label="Active" value={counts.active} icon={CircleCheck} to="/flows?status=active" tone="bg-emerald-50 text-emerald-600" />
        <Stat label="Inactive" value={counts.inactive} icon={CircleOff} to="/flows?status=inactive" tone="bg-rose-50 text-rose-600" />
        <Stat label="Draft" value={counts.draft} icon={FilePen} to="/flows?status=draft" tone="bg-amber-50 text-amber-600" />
        <Stat label="Routers" value={counts.routers} icon={GitFork} to="/flows" tone="bg-violet-50 text-violet-600" />
        <Stat label="Total steps" value={counts.steps} icon={ListTree} to="/flows" tone="bg-sky-50 text-sky-600" />
      </div>

      {counts.flows === 0 ? (
        <Card>
          <EmptyState
            icon={Workflow}
            title="No flows yet"
            text="Add your first Pabbly flow, or import your whole flow list from a CSV (one row per flow) and then add the steps."
            action={
              canEdit && (
                <div className="flex gap-2">
                  <Button variant="secondary" icon={Upload} onClick={() => navigate('/import')}>Import CSV</Button>
                  <Button icon={Plus} onClick={() => setCreating(true)}>New flow</Button>
                </div>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Flows by folder">
            <ul className="space-y-2.5 p-4 sm:p-5">
              {meta.folders.map((f) => (
                <li key={f.folder}>
                  <Link to={`/flows?folder=${encodeURIComponent(f.folder)}`} className="group block">
                    <div className="flex justify-between text-sm">
                      <span className="truncate text-slate-700 group-hover:text-indigo-600">{f.folder}</span>
                      <span className="font-medium text-slate-900">{f.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${(f.count / maxFolder) * 100}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
              {meta.unfiled > 0 && (
                <li>
                  <Link to="/flows?folder=__none__" className="group block">
                    <div className="flex justify-between text-sm">
                      <span className="italic text-slate-500 group-hover:text-indigo-600">No folder</span>
                      <span className="font-medium text-slate-900">{meta.unfiled}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-slate-400" style={{ width: `${(meta.unfiled / maxFolder) * 100}%` }} />
                    </div>
                  </Link>
                </li>
              )}
            </ul>
          </Card>

          <Card title="Most-used apps">
            {meta.apps.length ? (
              <ul className="divide-y divide-slate-100">
                {meta.apps.slice(0, 10).map((a) => (
                  <li key={a.app}>
                    <Link to={`/flows?app=${encodeURIComponent(a.app)}`} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 sm:px-5">
                      <span className="truncate text-slate-700">{a.app}</span>
                      <span className="text-xs text-slate-500">{a.flows} flow{a.flows === 1 ? '' : 's'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-slate-500">Apps appear here once steps are added.</p>
            )}
          </Card>

          <Card title="Recent changes" actions={<Link to="/activity" className="text-xs font-medium text-indigo-600 hover:underline">View all</Link>}>
            {activity ? <ActivityList items={activity} /> : <PageLoader />}
          </Card>
        </div>
      )}

      <FlowFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(flow) => {
          setCreating(false);
          navigate(`/flows/${flow.id}`);
        }}
      />
    </div>
  );
}
