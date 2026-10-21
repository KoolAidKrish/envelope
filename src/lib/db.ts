import postgres from 'postgres';
import schema from '../../db/schema.sql?raw';
import { env } from './env';

type Sql = postgres.Sql<Record<string, never>>;

let client: Sql | undefined;
let schemaReady: Promise<void> | undefined;

function connect(): Sql {
  const url = env('DATABASE_URL');
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  return postgres(url, {
    // Supabase's transaction pooler doesn't support prepared statements.
    prepare: false,
    // Serverless functions handle one request at a time.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? false : 'require',
    onnotice: () => {},
  });
}

/** Returns the database client, creating tables on first use. */
export async function db(): Promise<Sql> {
  client ??= connect();
  if (!schemaReady) {
    // .simple() sends the whole file as one multi-statement query.
    const setup = client.unsafe(schema);
    schemaReady = (typeof setup.simple === 'function' ? setup.simple() : setup).then(
      () => undefined,
      (err: unknown) => {
        schemaReady = undefined;
        throw err;
      },
    );
  }
  await schemaReady;
  return client;
}
