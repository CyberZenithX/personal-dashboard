/**
 * Tiny SQL layer.
 *  - DATABASE_URL set            -> Neon serverless driver (HTTP; works in Vercel Functions).
 *  - DATABASE_URL unset (dev)    -> embedded PGlite persisted in ./.data/pglite (zero-config).
 *
 * Usage: const rows = await sql<Row>`select * from tasks where id = ${id}`;
 */
import { neon } from '@neondatabase/serverless';

type Row = Record<string, unknown>;
interface Driver {
  query(text: string, params: unknown[]): Promise<Row[]>;
  exec(script: string): Promise<void>;
}

let driver: Promise<Driver> | null = null;

async function makeDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = neon(url);
    return {
      query: async (text, params) => (await client.query(text, params as never[])) as Row[],
      // The HTTP driver runs one statement per call; the schema file is simple enough to split.
      exec: async (script) => {
        const stmts = script
          .replace(/^\s*--.*$/gm, '')
          .split(/;\s*(?:\r?\n|$)/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const s of stmts) await client.query(s);
      }
    };
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is not set. Add your Neon connection string in the Vercel project settings.');
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { mkdirSync } = await import('node:fs');
  const dir = process.env.PGLITE_DIR || './.data/pglite';
  mkdirSync(dir.replace(/[\\/][^\\/]*$/, '') || '.', { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return {
    query: async (text, params) => (await db.query<Row>(text, params as unknown[])).rows,
    exec: async (script) => {
      await db.exec(script);
    }
  };
}

function getDriver(): Promise<Driver> {
  driver ??= makeDriver();
  return driver;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await (await getDriver()).query(text, params)) as T[];
}

export async function sql<T = Row>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) text += `$${i + 1}` + strings[i + 1];
  return query<T>(text, values);
}

export async function exec(script: string): Promise<void> {
  await (await getDriver()).exec(script);
}
