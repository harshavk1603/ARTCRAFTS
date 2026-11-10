import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) throw new Error('Set DATABASE_URL or DIRECT_URL before importing the SQLite data.');

const sourcePath = resolve(process.cwd(), process.env.DB_PATH || 'data/artcrafts.sqlite');
if (!existsSync(sourcePath)) throw new Error(`SQLite source database was not found at ${sourcePath}. Set DB_PATH to its location.`);

// Parent tables precede dependent tables to satisfy the foreign keys.
const tables = [
  'users', 'categories', 'products', 'artisans', 'gallery_items', 'sessions', 'addresses',
  'orders', 'order_items', 'custom_requests', 'contact_messages', 'processed_webhooks',
];
const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
const url = new URL(connectionString);
if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
if (url.searchParams.get('sslmode')?.toLowerCase() === 'require') url.searchParams.set('uselibpqcompat', 'true');
const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });

try {
  sqlite.exec('BEGIN');
  const integrity = sqlite.prepare('PRAGMA quick_check').get()?.quick_check;
  if (integrity !== 'ok') throw new Error('SQLite source failed its integrity check.');
  const sourceRows = new Map();
  for (const table of tables) {
    const exists = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!exists) throw new Error(`SQLite source is missing the expected table "${table}".`);
    const columns = sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(column => column.name);
    sourceRows.set(table, { columns, rows: sqlite.prepare(`SELECT * FROM "${table}"`).all() });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // This import is intentionally all-or-nothing and refuses a seeded/nonempty target.
    // It prevents silently mixing the existing SQLite store with a partially used project.
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      if (result.rows[0].count !== 0) throw new Error(`Supabase table "${table}" is not empty; import stopped without copying any rows.`);
    }

    let total = 0;
    for (const table of tables) {
      const { columns, rows } = sourceRows.get(table);
      if (!rows.length) continue;
      const quotedColumns = columns.map(column => `"${column.replaceAll('"', '""')}"`).join(', ');
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const insert = `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders})`;
      for (const row of rows) {
        await client.query(insert, columns.map(column => row[column]));
        total++;
      }
    }
    await client.query('COMMIT');
    console.log(`Imported ${total} rows from SQLite to Supabase across ${tables.length} application tables.`);
    for (const table of tables) console.log(`  ${table}: ${sourceRows.get(table).rows.length}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === 'XX000' && /tenant\/user/i.test(error.message)) {
      console.error('Supabase rejected the pooler host or username. Copy the complete Session pooler URI from the project Connect dialog; do not construct the host manually.');
    } else if (error.code === '28P01') {
      console.error('Supabase rejected the database password. Replace only the password in the copied connection URI and percent-encode reserved characters.');
    } else if (error.code) {
      console.error(`SQLite import failed (${error.code}); the Supabase transaction was rolled back. Record details were not printed.`);
    } else {
      console.error(`SQLite import stopped: ${error.message}`);
    }
    process.exitCode = 1;
  } finally {
    client.release();
  }
} finally {
  sqlite.close();
  await pool.end();
}
