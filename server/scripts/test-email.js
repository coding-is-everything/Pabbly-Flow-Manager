// Usage: npm run test-email -- you@example.com
// Checks the SMTP settings in .env and sends one test email, printing the exact error and a fix if it fails.
import { mailConfigured, mailHint, mailSummary, sendMail, verifyMail } from '../lib/mailer.js';

const to = process.argv[2];

async function main() {
  if (!mailConfigured()) {
    console.log('✗ SMTP_HOST is empty in .env, so no email is sent.');
    console.log('  Locally, login codes are printed in the terminal running "npm run dev" instead.');
    console.log('  To send real emails, fill SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM in .env (see .env.example).');
    process.exitCode = 1;
    return;
  }
  console.log(`Using ${mailSummary()}`);

  process.stdout.write('1. Connecting and logging in… ');
  try {
    await verifyMail();
    console.log('OK');
  } catch (err) {
    console.log('FAILED');
    console.log(`   Error: ${err.message}`);
    console.log(`   Fix:   ${mailHint(err)}`);
    process.exitCode = 1;
    return;
  }

  if (!to) {
    console.log('2. Skipped sending (add an address: npm run test-email -- you@example.com)');
    return;
  }
  process.stdout.write(`2. Sending a test email to ${to}… `);
  try {
    await sendMail({
      to,
      subject: 'Pabbly Flow Manager — test email',
      text: 'If you can read this, login codes will be delivered. You can delete this email.',
      html: '<p>If you can read this, login codes will be delivered. You can delete this email.</p>',
    });
    console.log('OK');
    console.log(`   Check the inbox (and spam) of ${to}. If it is in spam, mark it "Not spam" so codes land in the inbox.`);
  } catch (err) {
    console.log('FAILED');
    console.log(`   Error: ${err.message}`);
    console.log(`   Fix:   ${mailHint(err)}`);
    process.exitCode = 1;
  }
}

main().finally(() => {
  // Let nodemailer close its socket, then exit (the DB pool is never opened by this script).
  setTimeout(() => process.exit(), 100);
});

