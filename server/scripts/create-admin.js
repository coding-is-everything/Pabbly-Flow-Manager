// Usage: npm run create-admin -- "Full Name" email@example.com
// Creates an admin user, or re-activates the user and makes them admin if the email exists.
// Admins sign in with a one-time code sent to this email (no password).
import { pool, query, queryOne } from '../db.js';
import { mailConfigured } from '../lib/mailer.js';

async function main() {
  const [name, emailArg] = process.argv.slice(2);
  if (!name || !emailArg) {
    console.log('Usage: npm run create-admin -- "Full Name" email@example.com');
    process.exitCode = 1;
    return;
  }
  const email = emailArg.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('That does not look like a valid email address.');
    process.exitCode = 1;
    return;
  }
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    await query("UPDATE users SET name = ?, role = 'admin', is_active = 1 WHERE id = ?", [name, existing.id]);
    console.log(`${email} is now an active admin.`);
  } else {
    await query("INSERT INTO users (name, email, role) VALUES (?, ?, 'admin')", [name, email]);
    console.log(`Admin ${email} created.`);
  }
  console.log(
    mailConfigured()
      ? 'Sign in on the login page — a code will be emailed to this address.'
      : 'SMTP is not set in .env, so when running locally the login code will be printed in the "npm run dev" terminal.',
  );
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
