import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LogOut, Pencil, UserPlus, Users } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_META } from '../lib/constants';
import { formatDateTime, timeAgo } from '../lib/format';
import type { Role, User } from '../lib/types';
import { useToast } from '../components/Toast';
import { Button, Card, ConfirmModal, EmptyState, ErrorBanner, Field, IconButton, Input, Modal, PageLoader, Select, cx } from '../components/ui';

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [revoking, setRevoking] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ users: User[] }>('/users').then((d) => setUsers(d.users)).catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(load, [load]);

  const update = async (u: User, patch: Record<string, unknown>, message: string) => {
    try {
      await api(`/users/${u.id}`, 'PATCH', patch);
      toast(message);
      load();
      return true;
    } catch (err) {
      toast(errorMessage(err), 'error');
      return false;
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    setBusy(true);
    if (await update(revoking, { revoke_sessions: true }, `${revoking.name} has been signed out of all devices`)) setRevoking(null);
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="mt-0.5 text-sm text-slate-500">Who can sign in and what they can do. Everyone signs in with a one-time code sent to their email.</p>
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
                  <th className="hidden px-3 py-2.5 md:table-cell">Last sign-in</th>
                  <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className={cx(!u.is_active && 'bg-slate-50')}>
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
                          onChange={(e) => update(u, { role: e.target.value }, `${u.name} is now ${ROLE_META[e.target.value as Role].label}`)}
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
                          title={isMe ? 'You cannot deactivate yourself' : u.is_active ? 'Click to deactivate (signs them out)' : 'Click to reactivate'}
                        >
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </button>
                      </td>
                      <td className="hidden px-3 py-3 text-xs text-slate-500 md:table-cell" title={formatDateTime(u.last_login_at)}>
                        {u.last_login_at ? timeAgo(u.last_login_at) : 'Never'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <IconButton icon={Pencil} label="Edit name / email" onClick={() => setEditing(u)} />
                        <IconButton icon={LogOut} label="Sign out of all devices" onClick={() => setRevoking(u)} disabled={!u.is_active} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <UserModal open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />
      <UserModal open={!!editing} user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      <ConfirmModal
        open={!!revoking}
        title="Sign this user out everywhere?"
        message={`${revoking?.name ?? ''} will be signed out on every device and will need a new email code to get back in.`}
        confirmLabel="Sign out"
        loading={busy}
        onConfirm={revoke}
        onClose={() => setRevoking(null)}
      />
    </div>
  );
}

/** Add a user (no `user`) or edit one's name and email. */
function UserModal({ open, user, onClose, onSaved }: { open: boolean; user?: User | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', role: 'editor' as Role });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(user ? { name: user.name, email: user.email, role: user.role } : { name: '', email: '', role: 'editor' });
    setError('');
  }, [open, user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (user) {
        await api(`/users/${user.id}`, 'PATCH', { name: form.name, email: form.email });
        toast(form.email.trim().toLowerCase() !== user.email ? `${form.name} updated — they now sign in with ${form.email.trim()}` : `${form.name} updated`);
      } else {
        await api('/users', 'POST', form);
        toast(`${form.name} added. They can sign in now with ${form.email.trim()}.`);
      }
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
      title={user ? `Edit ${user.name}` : 'Add user'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" loading={busy}>{user ? 'Save' : 'Add user'}</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
          </Field>
          <Field label="Email" required hint="Login codes are sent here">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
        </div>
        {user && form.email.trim().toLowerCase() !== user.email && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
            Changing the email signs {user.name} out everywhere. From now on their codes go to the new address.
          </p>
        )}
        {!user && (
          <Field label="Role" hint={ROLE_META[form.role].hint}>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        )}
        {!user && (
          <p className="text-xs text-slate-500">
            No password to share: tell them to open the app and enter this email. They’ll get a 6-digit code to sign in.
          </p>
        )}
      </form>
    </Modal>
  );
}
