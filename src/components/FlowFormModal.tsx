import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { useMeta } from '../lib/meta';
import type { Flow, FlowStatus } from '../lib/types';
import { Button, ErrorBanner, Field, Input, Modal, Select, Textarea } from './ui';
import { useToast } from './Toast';

interface Props {
  open: boolean;
  flow?: Flow | null; // edit mode when provided
  onClose: () => void;
  onSaved: (flow: Flow) => void;
}

const EMPTY = {
  name: '', status: 'active' as FlowStatus, folder: '', trigger_app: '', pabbly_url: '', webhook_url: '',
  owner: '', tags: '', description: '', notes: '',
};

export default function FlowFormModal({ open, flow, onClose, onSaved }: Props) {
  const { meta, reloadMeta } = useMeta();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      flow
        ? {
            name: flow.name, status: flow.status, folder: flow.folder ?? '', trigger_app: flow.trigger_app ?? '',
            pabbly_url: flow.pabbly_url ?? '', webhook_url: flow.webhook_url ?? '', owner: flow.owner ?? '',
            tags: flow.tags ?? '', description: flow.description ?? '', notes: flow.notes ?? '',
          }
        : EMPTY,
    );
  }, [open, flow]);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = flow
        ? await api<{ flow: Flow }>(`/flows/${flow.id}`, 'PATCH', form)
        : await api<{ flow: Flow }>('/flows', 'POST', form);
      toast(flow ? 'Flow updated' : 'Flow created');
      reloadMeta();
      onSaved(res.flow);
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
      title={flow ? 'Edit flow' : 'New flow'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="flow-form" loading={busy}>{flow ? 'Save changes' : 'Create flow'}</Button>
        </>
      }
    >
      <form id="flow-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2"><ErrorBanner message={error} /></div>}
        <Field label="Flow name" required className="sm:col-span-2" hint="Use the same name as in Pabbly so imports can match it.">
          <Input value={form.name} onChange={set('name')} required autoFocus placeholder="e.g. Razorpay Payment → Gallabox WhatsApp + Google Sheet" />
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={set('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="draft">Draft</option>
          </Select>
        </Field>
        <Field label="Folder" hint="The Pabbly folder this flow lives in">
          <Input value={form.folder} onChange={set('folder')} list="folder-options" placeholder="e.g. Payments" />
        </Field>
        <Field label="Pabbly workflow URL" className="sm:col-span-2" hint="Open the flow in Pabbly and copy the address from the browser bar">
          <Input type="url" value={form.pabbly_url} onChange={set('pabbly_url')} placeholder="https://connect.pabbly.com/workflow/mapping/…" />
        </Field>
        <Field label="Webhook URL" className="sm:col-span-2" hint="Only if the trigger is a webhook">
          <Input type="url" value={form.webhook_url} onChange={set('webhook_url')} placeholder="https://connect.pabbly.com/workflow/sendwebhookdata/…" />
        </Field>
        <Field label="Trigger app">
          <Input value={form.trigger_app} onChange={set('trigger_app')} list="app-options" placeholder="e.g. Razorpay, Webhook, Facebook Lead Ads" />
        </Field>
        <Field label="Owner" hint="Who is responsible for this flow">
          <Input value={form.owner} onChange={set('owner')} list="owner-options" />
        </Field>
        <Field label="Tags" className="sm:col-span-2" hint="Comma separated, e.g. payments, whatsapp, kundali">
          <Input value={form.tags} onChange={set('tags')} />
        </Field>
        <Field label="Purpose" className="sm:col-span-2" hint="What does this flow do, in one or two lines?">
          <Textarea value={form.description} onChange={set('description')} rows={2} />
        </Field>
        <Field label="Notes" className="sm:col-span-2" hint="Gotchas, linked sheets, template names, who to ask…">
          <Textarea value={form.notes} onChange={set('notes')} rows={3} />
        </Field>
        <datalist id="folder-options">{meta?.folders.map((f) => <option key={f.folder} value={f.folder} />)}</datalist>
        <datalist id="app-options">{meta?.apps.map((a) => <option key={a.app} value={a.app} />)}</datalist>
        <datalist id="owner-options">{meta?.owners.map((o) => <option key={o} value={o} />)}</datalist>
      </form>
    </Modal>
  );
}
