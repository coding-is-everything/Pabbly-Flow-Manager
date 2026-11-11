// Local development server. On Vercel, api/index.js is used instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { config } from './config.js';
import { query } from './db.js';
import { mailConfigured, mailHint, mailSummary, verifyMail } from './lib/mailer.js';

app.listen(config.port, async () => {
  console.log(`API running on http://localhost:${config.port}  (health: /api/health)`);

  try {
    await query('SELECT 1 FROM login_otps LIMIT 1');
    console.log('Database: ✓ connected');
  } catch (err) {
    console.log(`Database: ✗ ${err.code === 'ER_NO_SUCH_TABLE' ? 'tables missing — run: npm run migrate' : `cannot connect (${err.code || err.message}) — check DATABASE_URL / DB_SSL in .env`}`);
  }

  // Say clearly where login codes will go, and test the SMTP login once at startup.
  if (!mailConfigured()) {
    console.log('Email: SMTP_HOST is empty → login codes are PRINTED BELOW in this terminal (not emailed).');
    return;
  }
  try {
    await verifyMail();
    console.log(`Email: ✓ SMTP login OK — ${mailSummary()}`);
  } catch (err) {
    console.log(`Email: ✗ SMTP login FAILED — ${mailSummary()}`);
    console.log(`       Error: ${err.message}`);
    console.log(`       Fix:   ${mailHint(err)}`);
    console.log('       Login codes cannot be sent until this is fixed. Test with: npm run test-email -- you@example.com');
  }
});

// .env is read only at startup, and "node --watch" does not watch it. When .env changes,
// touch this file so node --watch restarts the server with the new values.
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const self = fileURLToPath(import.meta.url);
  fs.watchFile(envPath, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs === prev.mtimeMs) return;
    console.log('.env changed — restarting the API…');
    const now = new Date();
    fs.utimesSync(self, now, now);
  });
}
