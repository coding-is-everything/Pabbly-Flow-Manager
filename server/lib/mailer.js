import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;

export const mailConfigured = () => !!config.smtp.host;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

/** Connects and logs in to the SMTP server without sending anything. Throws on failure. */
export async function verifyMail() {
  await getTransporter().verify();
}

/** One-line description of where mail goes, safe to print (no password). */
export function mailSummary() {
  if (!mailConfigured()) return 'SMTP_HOST is empty';
  const { host, port, secure, user } = config.smtp;
  return `${host}:${port} (${secure ? 'SSL' : 'STARTTLS'}) as ${user || '(no login)'}, from "${config.mailFrom || '(MAIL_FROM empty)'}"`;
}

/** Turns common SMTP errors into a plain-English fix. */
export function mailHint(err) {
  const msg = `${err?.code || ''} ${err?.responseCode || ''} ${err?.message || ''}`;
  const { port, secure, host } = config.smtp;
  if (/EAUTH|535|534|Invalid login|Username and Password not accepted|Authentication/i.test(msg)) {
    return [
      'The SMTP server rejected SMTP_USER / SMTP_PASS.',
      host.includes('gmail') ? 'Gmail needs an App Password (Google Account → Security → 2-Step Verification → App passwords), not your normal password.' : '',
      host.includes('zoho') ? 'Zoho needs an app-specific password (Zoho Account → Security → App Passwords). Also check the host: use smtp.zoho.in for accounts on zoho.in and smtp.zoho.com for zoho.com.' : '',
    ].filter(Boolean).join(' ');
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return `The host "${host}" could not be found. Check SMTP_HOST for typos and that this computer is online.`;
  if (/ETIMEDOUT|ECONNREFUSED|ESOCKET|ECONNECTION|Greeting never received|wrong version number/i.test(msg)) {
    if (port === 465 && !secure) return 'Port 465 needs SMTP_SECURE=true (or remove SMTP_SECURE).';
    if (port === 587 && secure) return 'Port 587 needs SMTP_SECURE=false (or remove SMTP_SECURE).';
    return `Could not connect to ${host}:${port}. Check SMTP_HOST/SMTP_PORT. Some networks block outgoing mail ports — try 587 instead of 465 (or the other way round).`;
  }
  if (/553|550|554|sender|not owned|relay|From/i.test(msg)) {
    return `The server refused the sender. MAIL_FROM must be an address your SMTP account may send from — usually exactly SMTP_USER (${config.smtp.user || 'empty'}).`;
  }
  return 'See the error above. Check every SMTP_* value in .env.';
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) {
    if (config.isProd) {
      throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.');
    }
    // Local development without SMTP: show the email in the terminal.
    console.log(`\n──── [DEV] email to ${to} ────\n${subject}\n\n${text}\n────────────────────────────\n`);
    return;
  }
  await getTransporter().sendMail({ from: config.mailFrom, to, subject, text, html });
}

export function sendOtpEmail(user, code) {
  const minutes = config.otp.ttlMinutes;
  const spaced = code.split('').join(' ');
  const text = [
    `Hi ${user.name},`,
    '',
    `Your Pabbly Flow Manager login code is: ${code}`,
    '',
    `It expires in ${minutes} minutes and can be used once.`,
    "If you didn't try to sign in, you can ignore this email — nobody can log in without this code.",
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
        <tr><td>
          <div style="font-size:14px;font-weight:600;color:#4f46e5">Pabbly Flow Manager</div>
          <h1 style="font-size:20px;margin:12px 0 8px">Your login code</h1>
          <p style="font-size:14px;color:#475569;margin:0 0 20px">Hi ${escapeHtml(user.name)}, enter this code to sign in:</p>
          <div style="font-family:Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#eef2ff;color:#312e81;border-radius:8px;padding:16px 0">${spaced}</div>
          <p style="font-size:13px;color:#64748b;margin:20px 0 0">It expires in ${minutes} minutes and works once. If you didn't try to sign in, ignore this email — nobody can log in without the code.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return sendMail({ to: user.email, subject: `${code} is your Pabbly Flow Manager login code`, text, html });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
