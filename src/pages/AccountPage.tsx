import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_META } from '../lib/constants';
import { useToast } from '../components/Toast';
import { Button, Card, ErrorBanner, Field, Input, RoleBadge } from '../components/ui';

export default function AccountPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('The new passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/change-password', 'POST', { current_password: current, new_password: next });
      toast('Password changed. Other devices have been logged out.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold text-slate-900">My account</h1>
      <Card title="Profile">
        <dl className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Name</dt>
            <dd className="mt-1 text-sm">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</dt>
            <dd className="mt-1 text-sm break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</dt>
            <dd className="mt-1"><RoleBadge role={user.role} /></dd>
            <dd className="mt-1 text-xs text-slate-500">{ROLE_META[user.role].hint}</dd>
          </div>
        </dl>
      </Card>
      <Card title="Change password">
        <form onSubmit={submit} className="space-y-4 p-5">
          {error && <ErrorBanner message={error} />}
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" hint="At least 8 characters">
              <Input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </Field>
          </div>
          <Button type="submit" loading={busy}>Change password</Button>
        </form>
      </Card>
    </div>
  );
}
