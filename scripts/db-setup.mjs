// Creates the tables ahead of time. Optional: the app also does this on first use.
// Usage: DATABASE_URL=... npm run db:setup
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL first.');
  process.exit(1);
}
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const sql = postgres(url, { prepare: false, max: 1, ssl: local ? false : 'require', onnotice: () => {} });
const setup = sql.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
await (typeof setup.simple === 'function' ? setup.simple() : setup);
await sql.end();
console.log('Database is ready.');
