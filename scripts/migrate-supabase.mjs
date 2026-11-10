import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) throw new Error('Set DIRECT_URL or DATABASE_URL before applying the Supabase schema.');

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../supabase/migrations/001_artcrafts_schema.sql');
const sql = await readFile(schemaPath, 'utf8');
const url = new URL(connectionString);
if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
if (url.searchParams.get('sslmode')?.toLowerCase() === 'require') url.searchParams.set('uselibpqcompat', 'true');
const pool = new pg.Pool({ connectionString: url.toString(), max: 1 });

try {
  await pool.query(sql);
  console.log('ARTCRAFTS Supabase schema applied successfully.');
} catch (error) {
  if (error.code === 'XX000' && /tenant\/user/i.test(error.message)) {
    console.error('Supabase rejected the pooler host or username. Copy the complete Session pooler URI from the project Connect dialog; do not construct the host manually.');
  } else if (error.code === '28P01') {
    console.error('Supabase rejected the database password. Replace only the password in the copied connection URI and percent-encode reserved characters.');
  } else {
    console.error(`Supabase schema migration failed${error.code ? ` (${error.code})` : ''}. Check the connection URI and database permissions; credentials are not printed.`);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
