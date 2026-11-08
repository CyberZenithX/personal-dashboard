import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exec } from '../src/lib/db';

async function main() {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
    console.warn('[migrate] DATABASE_URL is not set – skipping migrations. Set it in Vercel and redeploy.');
    return;
  }
  const schema = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await exec(schema);
  console.log('[migrate] schema is up to date');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  }
);
