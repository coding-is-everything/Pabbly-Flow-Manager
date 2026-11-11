import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Plus, Search, Upload, Workflow, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMeta } from '../lib/meta';
import { formatDateTime, isHttpUrl, splitTags, timeAgo } from '../lib/format';
import { GAP_LABELS } from '../lib/constants';
import type { FlowSummary } from '../lib/types';
import FlowFormModal from '../components/FlowFormModal';
import { Button, Card, CopyButton, EmptyState, ErrorBanner, IconButton, Input, PageLoader, Select, StatusBadge, Tag } from '../components/ui';

const FILTER_KEYS = ['q', 'status', 'folder', 'app', 'tag', 'gap'] as const;

export default function FlowsPage() {
  const [params, setParams] = useSearchParams();
  const { canEdit } = useAuth();
  const { meta } = useMeta();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<FlowSummary[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState(params.get('q') || '');

  const query = params.toString();

  const load = useCallback(() => {
    setError('');
    api<{ flows: FlowSummary[] }>(`/flows?${query}`)
      .then((d) => setFlows(d.flows))
      .catch((err) => setError(errorMessage(err)));
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce the text search into the URL
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') || '') !== q) setParam('q', q);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const hasFilters = FILTER_KEYS.some((k) => params.get(k));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Flows</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {flows ? `${flows.length} flow${flows.length === 1 ? '' : 's'}${hasFilters ? ' match your filters' : ''}` : 'Loading…'}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={Upload} onClick={() => navigate('/import')}>Import CSV</Button>
            <Button icon={Plus} onClick={() => setCreating(true)}>New flow</Button>
          </div>
        )}
      </div>

      <Card>
        <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, URL, owner, tag…" className="pl-9" />
          </div>
          <Select value={params.get('status') || ''} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="draft">Draft</option>
          </Select>
          <Select value={params.get('folder') || ''} onChange={(e) => setParam('folder', e.target.value)} aria-label="Folder">
            <option value="">All folders</option>
            {meta?.folders.map((f) => <option key={f.folder} value={f.folder}>{f.folder} ({f.count})</option>)}
            {!!meta?.unfiled && <option value="__none__">No folder ({meta.unfiled})</option>}
          </Select>
          <Select value={params.get('app') || ''} onChange={(e) => setParam('app', e.target.value)} aria-label="App">
            <option value="">All apps</option>
            {meta?.apps.map((a) => <option key={a.app} value={a.app}>{a.app} ({a.flows})</option>)}
          </Select>
          <div className="flex gap-2">
            <Select value={params.get('sort') || 'updated'} onChange={(e) => setParam('sort', e.target.value === 'updated' ? '' : e.target.value)} aria-label="Sort">
              <option value="updated">Recently updated</option>
              <option value="name">Name A–Z</option>
              <option value="created">Newest first</option>
            </Select>
          </div>
          {(meta?.tags.length || hasFilters) ? (
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-6">
              {!!meta?.tags.length && (
                <div className="w-full sm:w-56">
                  <Select value={params.get('tag') || ''} onChange={(e) => setParam('tag', e.target.value)} aria-label="Tag">
                    <option value="">All tags</option>
                    {meta.tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>)}
                  </Select>
                </div>
              )}
              {hasFilters && (
                <Button variant="ghost" size="sm" icon={X} onClick={() => { setQ(''); setParams(new URLSearchParams(), { replace: true }); }}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : null}
        </div>

        {params.get('gap') && GAP_LABELS[params.get('gap')!] && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-5">
            <span>
              Showing flows with: <b>{GAP_LABELS[params.get('gap')!]}</b>
            </span>
            <button onClick={() => setParam('gap', '')} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium hover:bg-amber-100">
              <X className="size-3.5" /> Remove
            </button>
          </div>
        )}
        {error && <div className="p-4"><ErrorBanner message={error} onRetry={load} /></div>}
        {!flows && !error && <PageLoader />}
        {flows && flows.length === 0 && (
          <EmptyState
            icon={Workflow}
            title={hasFilters ? 'No flows match these filters' : 'No flows yet'}
            text={hasFilters ? 'Try a different search or clear the filters.' : 'Create a flow or import your flow list from CSV.'}
            action={canEdit && !hasFilters && <Button icon={Plus} onClick={() => setCreating(true)}>New flow</Button>}
          />
        )}
        {flows && flows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 sm:px-5">Flow</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Trigger</th>
                  <th className="px-3 py-2.5 text-center">Steps</th>
                  <th className="hidden px-3 py-2.5 lg:table-cell">Owner</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Updated</th>
                  <th className="px-3 py-2.5"><span className="sr-only">Links</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flows.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70">
                    <td className="max-w-md px-4 py-3 sm:px-5">
                      <Link to={`/flows/${f.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {f.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {f.folder && <span>{f.folder}</span>}
                        {splitTags(f.tags).slice(0, 4).map((t) => <Tag key={t}>{t}</Tag>)}
                      </div>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={f.status} /></td>
                    <td className="hidden px-3 py-3 text-slate-600 md:table-cell">{f.trigger_app || '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="font-medium text-slate-900">{Number(f.steps_count)}</span>
                      {Number(f.routers_count) > 0 && (
                        <div className="text-xs text-violet-600">{f.routers_count} router{Number(f.routers_count) === 1 ? '' : 's'}</div>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 text-slate-600 lg:table-cell">{f.owner || '—'}</td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-xs text-slate-500 md:table-cell" title={formatDateTime(f.updated_at)}>
                      {timeAgo(f.updated_at)}
                      {f.updated_by_name && <div>by {f.updated_by_name}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {isHttpUrl(f.webhook_url) && <CopyButton value={f.webhook_url} label="Copy webhook URL" />}
                      {isHttpUrl(f.pabbly_url) && (
                        <a href={f.pabbly_url} target="_blank" rel="noopener noreferrer">
                          <IconButton icon={ExternalLink} label="Open in Pabbly" tabIndex={-1} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
