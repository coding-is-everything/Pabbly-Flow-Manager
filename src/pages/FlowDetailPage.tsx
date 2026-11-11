import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, CopyPlus, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMeta } from '../lib/meta';
import { collectIds, countSteps, formatDateTime, isHttpUrl, splitTags, stepLabel, timeAgo } from '../lib/format';
import { KIND_META } from '../lib/constants';
import type { Activity, Flow, Step } from '../lib/types';
import StepTree from '../components/StepTree';
import StepFormModal from '../components/StepFormModal';
import FlowFormModal from '../components/FlowFormModal';
import ActivityList from '../components/ActivityList';
import { useToast } from '../components/Toast';
import { Button, Card, ConfirmModal, CopyButton, ErrorBanner, PageLoader, StatusBadge, Tag } from '../components/ui';

interface StepFormState {
  open: boolean;
  step: Step | null;
  parent: Step | null;
  after: Step | null;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function UrlRow({ url }: { url: string | null }) {
  if (!isHttpUrl(url)) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex items-start gap-1">
      <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 font-mono text-xs break-all text-indigo-600 hover:underline">
        {url}
      </a>
      <CopyButton value={url} label="Copy URL" />
    </div>
  );
}

export default function FlowDetailPage() {
  const { id } = useParams();
  const flowId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { canEdit, isAdmin } = useAuth();
  const { reloadMeta } = useMeta();

  const [flow, setFlow] = useState<Flow | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [stepForm, setStepForm] = useState<StepFormState>({ open: false, step: null, parent: null, after: null });
  const [deletingStep, setDeletingStep] = useState<Step | null>(null);
  const [editingFlow, setEditingFlow] = useState(false);
  const [deletingFlow, setDeletingFlow] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([
        api<{ flow: Flow; steps: Step[] }>(`/flows/${flowId}`),
        api<{ activity: Activity[] }>(`/activity?flow_id=${flowId}&limit=15`),
      ]);
      setFlow(d.flow);
      setSteps(d.steps);
      setActivity(a.activity);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [flowId]);

  useEffect(() => {
    setFlow(null);
    load();
  }, [load]);

  // id → parent step, for opening the edit form with the right context
  const parentOf = useMemo(() => {
    const map = new Map<number, Step | null>();
    const walk = (list: Step[], parent: Step | null) => {
      for (const s of list) {
        map.set(s.id, parent);
        walk(s.children, s);
      }
    };
    walk(steps, null);
    return map;
  }, [steps]);

  const totals = useMemo(() => countSteps(steps), [steps]);
  const hasTrigger = steps.some((s) => s.kind === 'trigger');

  const toggle = useCallback((stepId: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const move = async (step: Step, direction: 'up' | 'down') => {
    try {
      await api(`/steps/${step.id}/move`, 'POST', { direction });
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const deleteStep = async () => {
    if (!deletingStep) return;
    setBusy(true);
    try {
      await api(`/steps/${deletingStep.id}`, 'DELETE');
      toast('Step deleted');
      setDeletingStep(null);
      reloadMeta();
      await load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      const d = await api<{ flow: Flow }>(`/flows/${flowId}/duplicate`, 'POST');
      toast('Flow duplicated as a draft');
      reloadMeta();
      navigate(`/flows/${d.flow.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteFlow = async () => {
    setBusy(true);
    try {
      await api(`/flows/${flowId}`, 'DELETE');
      toast('Flow deleted');
      reloadMeta();
      navigate('/flows');
    } catch (err) {
      toast(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  if (error && !flow) {
    return (
      <div className="space-y-4">
        <Link to="/flows" className="text-sm text-indigo-600 hover:underline">← Back to flows</Link>
        <ErrorBanner message={error} onRetry={load} />
      </div>
    );
  }
  if (!flow) return <PageLoader />;

  const nestedCount = deletingStep ? countSteps(deletingStep.children).steps : 0;
  const tags = splitTags(flow.tags);

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <Link to="/flows" className="hover:text-indigo-600">Flows</Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate text-slate-700">{flow.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold break-words text-slate-900">{flow.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <StatusBadge status={flow.status} />
            {flow.folder && (
              <Link to={`/flows?folder=${encodeURIComponent(flow.folder)}`} className="hover:text-indigo-600">{flow.folder}</Link>
            )}
            {tags.map((t) => (
              <Link key={t} to={`/flows?tag=${encodeURIComponent(t)}`}><Tag>{t}</Tag></Link>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isHttpUrl(flow.pabbly_url) && (
            <a href={flow.pabbly_url} target="_blank" rel="noopener noreferrer">
              <Button icon={ExternalLink} tabIndex={-1}>Open in Pabbly</Button>
            </a>
          )}
          {canEdit && <Button variant="secondary" icon={Pencil} onClick={() => setEditingFlow(true)}>Edit</Button>}
          {canEdit && <Button variant="secondary" icon={CopyPlus} onClick={duplicate} loading={busy && !deletingFlow && !deletingStep}>Duplicate</Button>}
          {isAdmin && <Button variant="secondary" icon={Trash2} onClick={() => setDeletingFlow(true)} className="text-rose-600">Delete</Button>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          className="min-w-0 lg:col-span-2"
          title={
            <span>
              Steps <span className="ml-1 font-normal text-slate-500">· {totals.steps} total{totals.routers ? ` · ${totals.routers} router${totals.routers === 1 ? '' : 's'}` : ''}</span>
            </span>
          }
          actions={
            steps.length > 0 && (
              <>
                {totals.routers > 0 && (
                  collapsed.size ? (
                    <Button variant="ghost" size="sm" icon={ChevronsUpDown} onClick={() => setCollapsed(new Set())}>Expand all</Button>
                  ) : (
                    <Button variant="ghost" size="sm" icon={ChevronsDownUp} onClick={() => setCollapsed(new Set(collectIds(steps, (s) => s.kind === 'router' || s.kind === 'route')))}>
                      Collapse all
                    </Button>
                  )
                )}
                {canEdit && (
                  <Button size="sm" icon={Plus} onClick={() => setStepForm({ open: true, step: null, parent: null, after: null })}>Add step</Button>
                )}
              </>
            )
          }
        >
          <StepTree
            steps={steps}
            canEdit={canEdit}
            collapsed={collapsed}
            toggle={toggle}
            onAdd={(parent, after) => setStepForm({ open: true, step: null, parent, after: after ?? null })}
            onEdit={(step) => setStepForm({ open: true, step, parent: parentOf.get(step.id) ?? null, after: null })}
            onDelete={setDeletingStep}
            onMove={move}
          />
        </Card>

        <div className="space-y-5">
          <Card title="Details">
            <dl className="space-y-4 p-4 sm:p-5">
              <Detail label="Webhook URL"><UrlRow url={flow.webhook_url} /></Detail>
              <Detail label="Pabbly workflow URL"><UrlRow url={flow.pabbly_url} /></Detail>
              <div className="grid grid-cols-2 gap-4">
                <Detail label="Trigger app">{flow.trigger_app || <span className="text-slate-400">—</span>}</Detail>
                <Detail label="Owner">{flow.owner || <span className="text-slate-400">—</span>}</Detail>
              </div>
              {flow.description && <Detail label="Purpose"><p className="whitespace-pre-wrap">{flow.description}</p></Detail>}
              {flow.notes && <Detail label="Notes"><p className="whitespace-pre-wrap">{flow.notes}</p></Detail>}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <Detail label="Created">
                  <span title={formatDateTime(flow.created_at)}>{timeAgo(flow.created_at)}</span>
                  {flow.created_by_name && <div className="text-xs text-slate-500">by {flow.created_by_name}</div>}
                </Detail>
                <Detail label="Last updated">
                  <span title={formatDateTime(flow.updated_at)}>{timeAgo(flow.updated_at)}</span>
                  {flow.updated_by_name && <div className="text-xs text-slate-500">by {flow.updated_by_name}</div>}
                </Detail>
              </div>
            </dl>
          </Card>

          <Card title="History">
            <ActivityList items={activity} showFlow={false} />
          </Card>
        </div>
      </div>

      <StepFormModal
        open={stepForm.open}
        flowId={flowId}
        step={stepForm.step}
        parent={stepForm.parent}
        after={stepForm.after}
        hasTrigger={hasTrigger}
        onClose={() => setStepForm((s) => ({ ...s, open: false }))}
        onSaved={() => {
          setStepForm((s) => ({ ...s, open: false }));
          load();
        }}
      />

      <FlowFormModal
        open={editingFlow}
        flow={flow}
        onClose={() => setEditingFlow(false)}
        onSaved={() => {
          setEditingFlow(false);
          load();
        }}
      />

      <ConfirmModal
        open={!!deletingStep}
        title={`Delete ${deletingStep ? KIND_META[deletingStep.kind].label.toLowerCase() : 'step'}?`}
        message={
          deletingStep && (
            <>
              <p>
                “<span className="font-medium text-slate-800">{stepLabel(deletingStep)}</span>” will be removed from this flow.
              </p>
              {nestedCount > 0 && (
                <p className="mt-2 font-medium text-rose-700">
                  This also deletes the {nestedCount} step{nestedCount === 1 ? '' : 's'} inside it.
                </p>
              )}
            </>
          )
        }
        loading={busy}
        onConfirm={deleteStep}
        onClose={() => setDeletingStep(null)}
      />

      <ConfirmModal
        open={deletingFlow}
        title="Delete this flow?"
        message={
          <p>
            “<span className="font-medium text-slate-800">{flow.name}</span>” and all {totals.steps} of its steps will be permanently deleted from the
            Flow Manager. Nothing changes in Pabbly itself.
          </p>
        }
        confirmLabel="Delete flow"
        loading={busy}
        onConfirm={deleteFlow}
        onClose={() => setDeletingFlow(false)}
      />
    </div>
  );
}
