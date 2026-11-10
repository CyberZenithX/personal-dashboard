import { NextResponse } from 'next/server';
import { authConfigured, checkPassword, COOKIE, makeToken, SESSION_DAYS } from '@/lib/auth';
import { exec, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

const WINDOW_MIN = 15;
const MAX_FAILS = 8;

let tableReady: Promise<void> | null = null;
/** The table is in db/schema.sql (run on build); this also covers a database that hasn't been migrated yet. */
function ensureTable(): Promise<void> {
  tableReady ??= exec(`create table if not exists login_attempts (id bigserial primary key, ip text not null, at timestamptz not null default now());
    create index if not exists login_attempts_ip_idx on login_attempts (ip, at);`).catch((e) => {
    tableReady = null;
    throw e;
  });
  return tableReady;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim().slice(0, 64);
}

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: 'APP_PASSWORD is not set on the server.' }, { status: 500 });
  }
  const ip = clientIp(req);
  try {
    await ensureTable();
    const r = await sql<{ n: number; first: string | null }>`
      select count(*)::int as n, min(at)::text as first from login_attempts
      where ip = ${ip} and at > now() - make_interval(mins => ${WINDOW_MIN})`;
    if ((r[0]?.n ?? 0) >= MAX_FAILS) {
      const first = r[0]?.first ? Date.parse(r[0].first) : Date.now();
      const wait = Math.max(1, Math.ceil((first + WINDOW_MIN * 60000 - Date.now()) / 60000));
      return NextResponse.json(
        { error: `Too many wrong passwords. Try again in ${wait} minute${wait === 1 ? '' : 's'}.` },
        { status: 429, headers: { 'retry-after': String(wait * 60) } }
      );
    }
  } catch (err) {
    // If the database is unreachable, still allow logging in (the password check doesn't need it).
    console.error('[login] rate limit check failed', err);
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!(await checkPassword(String(body.password ?? '')))) {
    try {
      await sql`insert into login_attempts (ip) values (${ip})`;
      // keep the table small
      await sql`delete from login_attempts where at < now() - interval '1 day'`;
    } catch { /* best effort */ }
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  try {
    await sql`delete from login_attempts where ip = ${ip}`;
  } catch { /* best effort */ }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86400
  });
  return res;
}
