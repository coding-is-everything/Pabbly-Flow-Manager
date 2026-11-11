import mysql from 'mysql2/promise';
import { config } from './config.js';

// One pool per server instance. On Vercel each warm function instance reuses it,
// so keep the limit small to stay under the hosted database's connection cap.
export const pool = mysql.createPool({
  uri: config.databaseUrl,
  ssl: config.dbSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  connectionLimit: config.isProd ? 3 : 10,
  waitForConnections: true,
  enableKeepAlive: true,
  timezone: 'Z',
  charset: 'utf8mb4',
});

// Store and read every timestamp in UTC; the browser converts to local time.
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** Run fn(conn) inside a transaction. conn.query has the same signature as pool.query. */
export async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}
