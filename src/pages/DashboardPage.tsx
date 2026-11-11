import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CircleCheck, ChevronRight, Download, ListPlus, Plus, Search, Upload, UserPlus, Workflow } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMeta } from '../lib/meta';
import { STATUS_CHART } from '../lib/constants';
import { formatDateTime, timeAgo } from '../lib/format';
import type { Dashboard } from '../lib/types';
import ActivityList from '../components/ActivityList';
import FlowFormModal from '../components/FlowFormModal';
import { BarList, Meter, SegmentedBar } from '../components/charts';
import { Button, Card, ErrorBanner, PageLoader, StatusBadge, cx } from '../components/ui';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Figure({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold text-slate-900">{value.toLocaleString('en-IN')}</dd>
      {sub && <dd className="text-xs text-slate-500">{sub}</dd>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, canEdit, isAdmin } = useAuth();
  const { reloadMeta } = useMeta();
  const navigate = useNavigate();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    setError('');
    api<Dashboard>('/dashboard')
      .then(setData)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
    reloadMeta();
  }, [load, reloadMeta]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 2) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  if (error && !data) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <PageLoader />;

  const { counts } = data;
  const healthPct = counts.flows ? Math.round((counts.documented / counts.flows) * 100) : 0;
  const healthTone = healthPct >= 80 ? 'good' : healthPct >= 50 ? 'warning' : 'danger';
  const openGaps = data.gaps.filter((g) => g.count > 0).length;
  const firstName = user?.name.split(' ')[0] ?? '';

  return (
    <div className="space-y-6">
      {/* Header + quick actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-2xl font-semibold text-slate-900">{greeting()}, {firstName}</h1>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Upload} onClick={() => navigate('/import')}>Import CSV</Button>
            <Button icon={Plus} onClick={() => setCreating(true)}>New flow</Button>
          </div>
        )}
      </div>

      {/* Quick search + shortcuts */}
      <Card className="p-4">
        <form onSubmit={search} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a flow, app, template, sheet or webhook…"
              className="h-11 w-full rounded-lg bg-slate-100 pl-11 pr-3 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <Button type="submit" className="h-11 px-5">Search</Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Jump to:</span>
          <Link to="/flows?status=active" className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800 hover:bg-emerald-100">Active ({counts.active})</Link>
          <Link to="/flows?status=draft" className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800 hover:bg-amber-100">Drafts ({counts.draft})</Link>
          <Link to="/flows?status=inactive" className="rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-800 hover:bg-rose-100">Inactive ({counts.inactive})</Link>
          {data.apps.slice(0, 3).map((a) => (
            <Link key={a.app} to={`/flows?app=${encodeURIComponent(a.app)}`} className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-200">
              {a.app}
            </Link>
          ))}
          <Link to="/import" className="ml-auto inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline">
            <Download className="size-3.5" /> Backup
          </Link>
        </div>
      </Card>

      {counts.flows === 0 ? (
        <Card title="Get started">
          <ol className="divide-y divide-slate-100">
            {[
              { icon: Upload, title: 'Import your flow list', text: 'Download the CSV template, list every Pabbly flow (one row each) and upload it.', action: canEdit && <Button size="sm" variant="secondary" onClick={() => navigate('/import')}>Open import</Button> },
              { icon: ListPlus, title: 'Add the steps for each flow', text: 'Open a flow and record its trigger, actions, routers and routes in the same order as in Pabbly.', action: canEdit && <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>New flow</Button> },
              { icon: UserPlus, title: 'Invite your team', text: 'Add people by email. They sign in with a one-time code — no passwords to share.', action: isAdmin && <Button size="sm" variant="secondary" onClick={() => navigate('/users')}>Add users</Button> },
            ].map((s, i) => (
              <li key={s.title} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="flex size-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">{i + 1}</div>
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm font-medium text-slate-900">{s.title}</p>
                  <p className="text-sm text-slate-500">{s.text}</p>
                </div>
                {s.action}
              </li>
            ))}
          </ol>
        </Card>
      ) : (
        <>
          {/* Overview: hero number + status split, and documentation health */}
          <div className="grid gap-5 *:min-w-0 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <div className="text-sm font-medium text-slate-500">Total flows</div>
                  <div className="text-5xl font-semibold tracking-tight text-slate-900">{counts.flows.toLocaleString('en-IN')}</div>
                </div>
                <dl className="grid grid-cols-3 gap-6 sm:gap-10">
                  <Figure label="Steps documented" value={counts.steps} />
                  <Figure label="Routers" value={counts.routers} sub={`${counts.routes} routes`} />
                  <Figure label="Apps connected" value={counts.apps} />
                </dl>
              </div>
              <div className="mt-6">
                <div className="mb-2 text-xs font-medium text-slate-500">Flows by status</div>
                <SegmentedBar
                  unit="flow"
                  segments={[
                    { key: 'active', label: 'Active', value: counts.active, ...STATUS_CHART.active, to: '/flows?status=active' },
                    { key: 'draft', label: 'Draft', value: counts.draft, ...STATUS_CHART.draft, to: '/flows?status=draft' },
                    { key: 'inactive', label: 'Inactive', value: counts.inactive, ...STATUS_CHART.inactive, to: '/flows?status=inactive' },
                  ]}
                />
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-sm font-medium text-slate-500">Documentation health</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-slate-900">{healthPct}%</span>
                <span className="text-sm text-slate-500">fully documented</span>
              </div>
              <div className="mt-3">
                <Meter value={counts.documented} max={counts.flows} tone={healthTone} />
              </div>
              <p className="mt-3 text-sm text-slate-600">
                <b className="text-slate-900">{counts.documented}</b> of {counts.flows} flows have steps, a Pabbly link and an owner.
              </p>
              {openGaps > 0 ? (
                <a href="#gaps" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
                  See what’s missing <ChevronRight className="size-4" />
                </a>
              ) : (
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CircleCheck className="size-4" /> Everything is documented
                </p>
              )}
            </Card>
          </div>

          {/* Gaps + charts */}
          <div className="grid gap-5 *:min-w-0 lg:grid-cols-3">
            <div id="gaps" className="scroll-mt-20">
              <Card title="Documentation gaps" className="h-full">
                <ul className="divide-y divide-slate-100">
                  {data.gaps.map((g) => {
                    const ok = g.count === 0;
                    const body = (
                      <>
                        <span
                          className={cx(
                            'flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums',
                            ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
                          )}
                        >
                          {ok ? <CircleCheck className="size-4" aria-label="None" /> : g.count}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cx('text-sm font-medium', ok ? 'text-slate-500' : 'text-slate-900')}>{g.label}</p>
                          <p className="truncate text-xs text-slate-500">
                            {ok ? 'None — nice.' : g.sample.map((s) => s.name).join(' · ') + (g.count > g.sample.length ? ` · +${g.count - g.sample.length} more` : '')}
                          </p>
                        </div>
                        {!ok && <ChevronRight className="mt-1 size-4 shrink-0 text-slate-400" />}
                      </>
                    );
                    return (
                      <li key={g.key}>
                        {ok ? (
                          <div className="flex items-start gap-3 px-4 py-3 sm:px-5">{body}</div>
                        ) : (
                          <Link to={`/flows?gap=${g.key}`} title={g.hint} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                            {body}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>

            <Card title="Flows by folder">
              <div className="p-3">
                <BarList
                  unit="flow"
                  rows={[
                    ...data.folders.map((f) => ({ key: f.folder, label: f.folder, value: f.count, to: `/flows?folder=${encodeURIComponent(f.folder)}` })),
                    ...(data.unfiled ? [{ key: '__none__', label: 'No folder', value: data.unfiled, to: '/flows?folder=__none__', muted: true }] : []),
                  ]}
                />
                {data.more_folders > 0 && (
                  <Link to="/flows" className="mt-2 block px-2 text-xs font-medium text-indigo-600 hover:underline">
                    +{data.more_folders} more folders
                  </Link>
                )}
              </div>
            </Card>

            <Card title="Most-used apps">
              <div className="p-3">
                {data.apps.length ? (
                  <BarList unit="flow" rows={data.apps.map((a) => ({ key: a.app, label: a.app, value: a.flows, to: `/flows?app=${encodeURIComponent(a.app)}` }))} />
                ) : (
                  <p className="px-2 py-3 text-sm text-slate-500">Apps appear once flows have a trigger app or steps.</p>
                )}
              </div>
            </Card>
          </div>

          {/* Recent changes */}
          <div className="grid gap-5 *:min-w-0 lg:grid-cols-2">
            <Card title="Recently updated flows" actions={<Link to="/flows" className="text-xs font-medium text-indigo-600 hover:underline">All flows</Link>}>
              <ul className="divide-y divide-slate-100">
                {data.recent_flows.map((f) => (
                  <li key={f.id}>
                    <Link to={`/flows/${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <Workflow className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{f.name}</p>
                        <p className="text-xs text-slate-500">
                          {[f.folder, `${f.steps_count} step${f.steps_count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <StatusBadge status={f.status} />
                        <p className="mt-1 text-xs text-slate-500" title={formatDateTime(f.updated_at)}>
                          {timeAgo(f.updated_at)}{f.updated_by_name ? ` · ${f.updated_by_name}` : ''}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Team activity" actions={<Link to="/activity" className="text-xs font-medium text-indigo-600 hover:underline">View all</Link>}>
              <ActivityList items={data.activity} />
            </Card>
          </div>
        </>
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
