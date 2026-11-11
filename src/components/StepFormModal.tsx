import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { useMeta } from '../lib/meta';
import { ALL_KINDS, KIND_META } from '../lib/constants';
import type { Step, StepKind } from '../lib/types';
import { Button, ErrorBanner, Field, Input, Modal, Textarea, cx } from './ui';
import { useToast } from './Toast';

interface Props {
  open: boolean;
  flowId: number;
  /** step being edited; null/undefined = create */
  step?: Step | null;
  /** container the step lives in (null = top level) */
  parent: Step | null;
  /** create only: insert right after this sibling */
  after?: Step | null;
  hasTrigger: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function allowedKinds(parent: Step | null, step: Step | null | undefined, hasTrigger: boolean): StepKind[] {
  if (parent?.kind === 'router') return ['route'];
  if (step?.kind === 'router' && step.children.length) return ['router'];
  let kinds = ALL_KINDS.filter((k) => k !== 'route');
  if (parent?.kind === 'route') kinds = kinds.filter((k) => k !== 'trigger');
  else if (hasTrigger && step?.kind !== 'trigger') kinds = kinds.filter((k) => k !== 'trigger');
  return kinds;
}

const EMPTY = { title: '', app: '', event: '', condition: '', description: '', notes: '' };

export default function StepFormModal({ open, flowId, step, parent, after, hasTrigger, onClose, onSaved }: Props) {
  const { meta, reloadMeta } = useMeta();
  const toast = useToast();
  const kinds = useMemo(() => allowedKinds(parent, step, hasTrigger), [parent, step, hasTrigger]);
  const [kind, setKind] = useState<StepKind>('action');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (step) {
      setKind(step.kind);
      setForm({
        title: step.title ?? '', app: step.app ?? '', event: step.event ?? '', condition: step.condition_text ?? '',
        description: step.description ?? '', notes: step.notes ?? '',
      });
    } else {
      const initial: StepKind = parent?.kind === 'router' ? 'route' : !parent && !hasTrigger ? 'trigger' : 'action';
      setKind(initial);
      setForm({ ...EMPTY, title: initial === 'route' ? `Route ${(parent?.children.length ?? 0) + 1}` : '' });
    }
  }, [open, step, parent, hasTrigger]);

  const km = KIND_META[kind];
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const titleLabel = kind === 'route' ? 'Route name' : kind === 'router' ? 'Router name' : kind === 'delay' ? 'Delay' : 'Step title';
  const titlePlaceholder =
    kind === 'route' ? 'e.g. Kundali buyers' : kind === 'router' ? 'e.g. Split by product' : kind === 'delay' ? 'e.g. Wait 10 minutes' : 'Optional — a short name for this step';

  const where = parent?.kind === 'route' ? `inside route “${parent.title || 'route'}”` : parent?.kind === 'router' ? `in router “${parent.title || 'router'}”` : 'at the top level';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      kind,
      title: form.title,
      // Hidden fields are cleared so a kind change doesn't leave stale data behind.
      app: km.hasApp ? form.app : '',
      event: km.hasApp ? form.event : '',
      condition: km.hasCondition ? form.condition : '',
      description: form.description,
      notes: form.notes,
    };
    try {
      if (step) {
        await api(`/steps/${step.id}`, 'PATCH', payload);
        toast('Step updated');
      } else {
        await api(`/flows/${flowId}/steps`, 'POST', { ...payload, parent_id: parent?.id ?? null, after_id: after?.id ?? null });
        toast(`${km.label} added`);
      }
      reloadMeta();
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={step ? `Edit ${KIND_META[step.kind].label.toLowerCase()}` : kinds.length === 1 && kinds[0] === 'route' ? 'Add route' : 'Add step'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="step-form" loading={busy}>{step ? 'Save changes' : `Add ${km.label.toLowerCase()}`}</Button>
        </>
      }
    >
      <form id="step-form" onSubmit={submit} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        {!step && (
          <p className="text-xs text-slate-500">
            Adding {where}
            {after ? `, right after “${after.title || after.app || KIND_META[after.kind].label}”` : ', at the end'}.
          </p>
        )}

        {kinds.length > 1 && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Step type</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {kinds.map((k) => {
                const m = KIND_META[k];
                const Icon = m.icon;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cx(
                      'flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ring-1 transition',
                      kind === k ? 'bg-indigo-50 font-medium text-indigo-900 ring-2 ring-indigo-600' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300',
                    )}
                  >
                    <span className={cx('flex size-6 shrink-0 items-center justify-center rounded', m.iconBox)}>
                      <Icon className="size-3.5" />
                    </span>
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{km.hint}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={titleLabel} className="sm:col-span-2">
            <Input value={form.title} onChange={set('title')} placeholder={titlePlaceholder} autoFocus={kinds.length === 1} />
          </Field>
          {km.hasApp && (
            <>
              <Field label="App" hint="As named in Pabbly">
                <Input value={form.app} onChange={set('app')} list="step-app-options" placeholder="e.g. Gallabox, Google Sheets, Razorpay" />
              </Field>
              <Field label={kind === 'trigger' ? 'Trigger event' : 'Action / event'}>
                <Input value={form.event} onChange={set('event')} placeholder={kind === 'trigger' ? 'e.g. Payment Captured' : 'e.g. Send Template Message'} />
              </Field>
            </>
          )}
          {km.hasCondition && (
            <Field
              label="Condition"
              className="sm:col-span-2"
              hint={kind === 'route' ? 'When does this route run? Leave empty for a fallback route.' : 'The flow continues only when this is true.'}
            >
              <Textarea value={form.condition} onChange={set('condition')} rows={2} className="font-mono" placeholder={'e.g. Product Name  (Text) Contains  "Kundali"\nAND Amount (Number) Greater than 499'} />
            </Field>
          )}
          <Field label="What this step does" className="sm:col-span-2">
            <Textarea value={form.description} onChange={set('description')} rows={2} placeholder="e.g. Sends the kundali_paid WhatsApp template to the buyer" />
          </Field>
          <Field label="Notes" className="sm:col-span-2" hint="Template names, sheet names, field mappings, gotchas…">
            <Textarea value={form.notes} onChange={set('notes')} rows={2} />
          </Field>
        </div>
        <datalist id="step-app-options">{meta?.apps.map((a) => <option key={a.app} value={a.app} />)}</datalist>
      </form>
    </Modal>
  );
}
