// Usage: npm run migrate
// Applies every server/migrations/*.sql file that has not been applied yet.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, query } from '../db.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

function splitStatements(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  await query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(190) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const applied = new Set((await query('SELECT name FROM schema_migrations')).map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const statements = splitStatements(fs.readFileSync(path.join(dir, file), 'utf8'));
    console.log(`Applying ${file} (${statements.length} statements)…`);
    for (const statement of statements) {
      await query(statement);
    }
    await query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    count++;
  }
  console.log(count ? `Done — ${count} migration(s) applied.` : 'Database is already up to date.');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
