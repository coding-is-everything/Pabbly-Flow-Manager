import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck, Terminal, Workflow } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { errorMessage } from '../lib/api';
import { Button, ErrorBanner, Field, Input, PageLoader } from '../components/ui';

const CODE_LENGTH = 6;
const LAST_EMAIL_KEY = 'pfm:last-email';

function readLastEmail() {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

export default function LoginPage() {
  const { user, loading, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(readLastEmail);
  const [code, setCode] = useState('');
  const [info, setInfo] = useState('');
  const [delivery, setDelivery] = useState<'email' | 'terminal'>('email');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  if (loading) return <PageLoader />;
  if (user) return <Navigate to={from} replace />;

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await requestOtp(email.trim());
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email.trim());
      } catch {
        /* storage unavailable — not important */
      }
      setInfo(res.message);
      setDelivery(res.delivery ?? 'email');
      setResendIn(res.resend_after);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length !== CODE_LENGTH || busy) return;
    setError('');
    setBusy(true);
    try {
      await verifyOtp(email.trim(), value);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) verify(digits); // auto-submit when complete (also works with paste / autofill)
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-900/40">
            <Workflow className="size-6 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-white">Pabbly Flow Manager</h1>
          <p className="mt-1 text-sm text-slate-400">
            {step === 'email'
              ? 'Sign in with a one-time code sent to your email'
              : delivery === 'terminal'
                ? 'Get the code from the npm run dev terminal'
                : 'Check your inbox for the code'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-xl">
          {step === 'email' ? (
            <form onSubmit={sendCode} className="space-y-4">
              {error && <ErrorBanner message={error} />}
              <Field label="Work email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="pl-9"
                  />
                </div>
              </Field>
              <Button type="submit" loading={busy} className="w-full">
                Send login code
              </Button>
              <p className="text-center text-xs text-slate-500">No password needed. No account? Ask an admin to add your email.</p>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
              className="space-y-4"
            >
              {delivery === 'terminal' ? (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
                  <Terminal className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <b>Local mode — no email is sent.</b> <code className="text-xs">SMTP_HOST</code> is empty in <code className="text-xs">.env</code>, so the
                    code is printed in the terminal running <code className="text-xs">npm run dev</code>. Fill the SMTP settings to receive real emails.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2.5 text-sm text-indigo-900">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  <span>{info} Check spam if you don’t see it.</span>
                </div>
              )}
              {error && <ErrorBanner message={error} />}
              <Field label={`${CODE_LENGTH}-digit code`}>
                <Input
                  ref={codeRef}
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={CODE_LENGTH + 2}
                  placeholder="••••••"
                  aria-label="Login code"
                  disabled={busy}
                  className="text-center font-mono text-2xl tracking-[0.5em] placeholder:tracking-[0.5em]"
                />
              </Field>
              <Button type="submit" loading={busy} disabled={code.length !== CODE_LENGTH} className="w-full">
                Verify &amp; sign in
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setError('');
                  }}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft className="size-3.5" />
                  Use a different email
                </button>
                <button
                  type="button"
                  disabled={resendIn > 0 || busy}
                  onClick={() => sendCode()}
                  className="font-medium text-indigo-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </button>
              </div>
              <p className="truncate text-center text-xs text-slate-500">Signing in as {email}</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
