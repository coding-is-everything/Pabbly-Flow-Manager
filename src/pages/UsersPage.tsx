import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { KeyRound, UserPlus, Users } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_META } from '../lib/constants';
import { formatDateTime, timeAgo } from '../lib/format';
import type { Role, User } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, ErrorBanner, Field, IconButton, Input, Modal, PageLoader, Select, cx } from '../components/ui';

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  const load = useCallback(() => {
    api<{ users: User[] }>('/users').then((d) => setUsers(d.users)).catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(load, [load]);

  const update = async (u: User, patch: Partial<Pick<User, 'role' | 'is_active'>>, message: string) => {
    try {
      await api(`/users/${u.id}`, 'PATCH', patch);
      toast(message);
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="mt-0.5 text-sm text-slate-500">Who can log in, and what they can do.</p>
        </div>
        <Button icon={UserPlus} onClick={() => setAdding(true)}>Add user</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(ROLE_META) as Role[]).map((r) => (
          <div key={r} className="rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200">
            <div className="font-medium text-slate-900">{ROLE_META[r].label}</div>
            <div className="text-xs text-slate-500">{ROLE_META[r].hint}</div>
          </div>
        ))}
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}
      <Card>
        {!users && !error && <PageLoader />}
        {users && users.length === 0 && <EmptyState icon={Users} title="No users" />}
        {users && users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5">User</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Last login</th>
                  <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className={cx(!u.is_active && 'bg-slate-50 text-slate-400')}>
                      <td className="px-5 py-3">
                        <div className={cx('font-medium', u.is_active ? 'text-slate-900' : 'text-slate-500')}>
                          {u.name} {isMe && <span className="text-xs font-normal text-slate-400">(you)</span>}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          value={u.role}
                          disabled={isMe}
                          title={isMe ? 'You cannot change your own role' : undefined}
                          onChange={(e) => update(u, { role: e.target.value as Role }, `${u.name} is now ${ROLE_META[e.target.value as Role].label}`)}
                          className="w-28 py-1.5"
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </Select>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          disabled={isMe}
                          onClick={() => update(u, { is_active: !u.is_active }, u.is_active ? `${u.name} deactivated` : `${u.name} reactivated`)}
                          className={cx(
                            'rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset disabled:cursor-not-allowed',
                            u.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 ring-slate-500/20 hover:bg-slate-200',
                          )}
                          title={isMe ? 'You cannot deactivate yourself' : u.is_active ? 'Click to deactivate (logs them out)' : 'Click to reactivate'}
                        >
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </button>
                      </td>
                      <td className="hidden px-3 py-3 text-xs text-slate-500 md:table-cell" title={formatDateTime(u.last_login_at)}>
                        {u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <IconButton icon={KeyRound} label="Reset password" onClick={() => setResetting(u)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddUserModal open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
    </div>
  );
}

function AddUserModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', role: 'editor' as Role, password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', role: 'editor', password: generatePassword() });
      setError('');
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/users', 'POST', form);
      toast(`${form.name} added. Share the password with them securely.`);
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
      title="Add user"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-user" loading={busy}>Add user</Button>
        </>
      }
    >
      <form id="add-user" onSubmit={submit} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
        </div>
        <Field label="Role" hint={ROLE_META[form.role].hint}>
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <Field label="Temporary password" hint="Share it privately; they can change it under My account.">
          <div className="flex gap-2">
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required className="font-mono" />
            <Button variant="secondary" onClick={() => setForm({ ...form, password: generatePassword() })}>Generate</Button>
          </div>
        </Field>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setPassword(generatePassword());
      setError('');
    }
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await api(`/users/${user.id}`, 'PATCH', { password });
      toast(`Password reset for ${user.name}. They have been logged out everywhere.`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      size="sm"
      title={`Reset password — ${user?.name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="reset-pw" loading={busy}>Reset password</Button>
        </>
      }
    >
      <form id="reset-pw" onSubmit={submit} className="space-y-3">
        {error && <ErrorBanner message={error} />}
        <Field label="New password" hint="Copy it before saving and share it privately.">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className="font-mono" />
        </Field>
      </form>
    </Modal>
  );
}
