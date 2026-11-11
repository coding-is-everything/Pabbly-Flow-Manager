import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, SearchX } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { KIND_META } from '../lib/constants';
import type { SearchResult, SearchStep } from '../lib/types';
import { Button, Card, EmptyState, ErrorBanner, Highlight, Input, PageLoader, StatusBadge, cx } from '../components/ui';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [input, setInput] = useState(q);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setInput(q);
    if (q.trim().length < 2) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError('');
    api<SearchResult>(`/search?q=${encodeURIComponent(q)}`)
      .then(setResult)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [q]);

  const grouped = useMemo(() => {
    const map = new Map<number, { flowName: string; flowStatus: SearchStep['flow_status']; steps: SearchStep[] }>();
    for (const s of result?.steps ?? []) {
      if (!map.has(s.flow_id)) map.set(s.flow_id, { flowName: s.flow_name, flowStatus: s.flow_status, steps: [] });
      map.get(s.flow_id)!.steps.push(s);
    }
    return [...map.entries()];
  }, [result]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim().length >= 2) setParams({ q: input.trim() });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Search</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Find every flow and step that mentions an app, template, sheet, webhook or condition — e.g. “Gallabox”, “kundali_paid”, “Leads Sheet”.
        </p>
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search…" className="pl-9" autoFocus />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {error && <ErrorBanner message={error} />}
      {loading && <PageLoader />}

      {result && !loading && (
        <>
          {result.flows.length === 0 && result.steps.length === 0 && (
            <Card>
              <EmptyState icon={SearchX} title={`Nothing found for “${result.q}”`} text="Try a shorter word, or check the spelling of the app name." />
            </Card>
          )}

          {result.flows.length > 0 && (
            <Card title={`Flows (${result.flows.length})`}>
              <ul className="divide-y divide-slate-100">
                {result.flows.map((f) => (
                  <li key={f.id}>
                    <Link to={`/flows/${f.id}`} className="block px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900"><Highlight text={f.name} q={result.q} /></span>
                        <StatusBadge status={f.status} />
                        {f.folder && <span className="text-xs text-slate-500">{f.folder}</span>}
                      </div>
                      {f.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600"><Highlight text={f.description} q={result.q} /></p>}
                      {f.webhook_url?.toLowerCase().includes(result.q.toLowerCase()) && (
                        <p className="mt-0.5 font-mono text-xs break-all text-slate-500"><Highlight text={f.webhook_url} q={result.q} /></p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {grouped.length > 0 && (
            <Card title={`Steps (${result.steps.length}) in ${grouped.length} flow${grouped.length === 1 ? '' : 's'}`}>
              <div className="divide-y divide-slate-100">
                {grouped.map(([flowId, g]) => (
                  <div key={flowId} className="px-4 py-3 sm:px-5">
                    <Link to={`/flows/${flowId}`} className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-indigo-600">
                      {g.flowName}
                      <StatusBadge status={g.flowStatus} />
                    </Link>
                    <ul className="mt-2 space-y-2">
                      {g.steps.map((s) => {
                        const m = KIND_META[s.kind];
                        const Icon = m.icon;
                        return (
                          <li key={s.id} className="flex gap-2.5 rounded-md bg-slate-50 px-3 py-2">
                            <span className={cx('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded', m.iconBox)}>
                              <Icon className="size-3.5" />
                            </span>
                            <div className="min-w-0 flex-1 text-sm">
                              <div className="flex flex-wrap items-center gap-x-2">
                                <span className="font-mono text-xs font-semibold text-slate-400">Step {s.number}</span>
                                <span className="font-medium text-slate-800">
                                  <Highlight text={[s.title, s.app, s.event].filter(Boolean).join(' · ') || m.label} q={result.q} />
                                </span>
                              </div>
                              {s.path.length > 0 && <p className="mt-0.5 text-xs text-slate-500">{s.path.join(' › ')}</p>}
                              {s.condition_text && (
                                <p className="mt-1 font-mono text-xs text-slate-600"><span className="font-sans font-semibold">IF </span><Highlight text={s.condition_text} q={result.q} /></p>
                              )}
                              {s.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600"><Highlight text={s.description} q={result.q} /></p>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
