import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Mail } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_META } from '../lib/constants';
import { formatDateTime } from '../lib/format';
import { useToast } from '../components/Toast';
import { Button, Card, ConfirmModal, RoleBadge } from '../components/ui';

export default function AccountPage() {
  const { user, logoutEverywhere } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const signOutEverywhere = async () => {
    setBusy(true);
    try {
      await logoutEverywhere();
      navigate('/login');
    } catch (err) {
      toast(errorMessage(err), 'error');
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

      <Card title="Sign-in & security">
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Mail className="size-4" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-slate-900">One-time code by email</p>
              <p className="text-slate-500">
                There is no password. Each time you sign in, a 6-digit code is sent to <b className="text-slate-700">{user.email}</b>. To change
                this email, ask an admin.
              </p>
              <p className="mt-1 text-xs text-slate-500">Last sign-in: {formatDateTime(user.last_login_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">Lost a phone or used a shared computer? End every session, including this one.</p>
            <Button variant="secondary" icon={LogOut} onClick={() => setConfirming(true)}>Sign out everywhere</Button>
          </div>
        </div>
      </Card>

      <ConfirmModal
        open={confirming}
        title="Sign out of all devices?"
        message="You will be signed out here and on every other device. Sign back in with a new code from your email."
        confirmLabel="Sign out everywhere"
        loading={busy}
        onConfirm={signOutEverywhere}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
