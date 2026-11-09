import { NextResponse } from 'next/server';
import { mutate, type Ctx } from './state';
import { BadRequest } from './validate';

export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    if (err instanceof BadRequest) return NextResponse.json({ error: err.message }, { status: 400 });
    // Don't leak database / stack details to the browser; they're in the server log.
    console.error('[api]', err);
    return NextResponse.json({ error: 'Something went wrong on the server. Please try again.' }, { status: 500 });
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const v = await req.json();
    return (v && typeof v === 'object' ? v : {}) as T;
  } catch {
    return {} as T;
  }
}

export function mutation(run: (c: Ctx) => Promise<{ label?: string; data?: Record<string, unknown> } | void>) {
  return handle(() => mutate(run));
}

export function idParam(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 2 ** 31 - 1) throw new BadRequest('Bad id');
  return n;
}
