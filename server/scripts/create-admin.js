// Usage: npm run create-admin -- "Full Name" email@example.com "StrongPassword123"
// Creates an admin user, or resets the password and promotes the user to admin if the email exists.
import bcrypt from 'bcryptjs';
import { pool, query, queryOne } from '../db.js';

async function main() {
  const [name, emailArg, password] = process.argv.slice(2);
  if (!name || !emailArg || !password) {
    console.log('Usage: npm run create-admin -- "Full Name" email@example.com "StrongPassword123"');
    process.exitCode = 1;
    return;
  }
  const email = emailArg.trim().toLowerCase();
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    await query(
      "UPDATE users SET name = ?, password_hash = ?, role = 'admin', is_active = 1, token_version = token_version + 1 WHERE id = ?",
      [name, hash, existing.id],
    );
    console.log(`Updated existing user ${email} — now an active admin with the new password.`);
  } else {
    await query("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')", [name, email, hash]);
    console.log(`Admin ${email} created. You can now log in.`);
  }
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
