import { NextResponse } from 'next/server';
import { authConfigured, checkPassword, COOKIE, makeToken, SESSION_DAYS } from '@/lib/auth';

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: 'APP_PASSWORD is not set on the server.' }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!(await checkPassword(String(body.password ?? '')))) {
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
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
