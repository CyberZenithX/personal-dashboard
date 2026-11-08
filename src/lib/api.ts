import { NextResponse } from 'next/server';
import { mutate, type Ctx } from './state';

export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { headers: { 'cache-control': 'no-store' } });
  } catch (err) {
    console.error('[api]', err);
    const message = err instanceof Error ? err.message : 'Something went wrong';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function mutation(run: (c: Ctx) => Promise<{ label?: string; data?: Record<string, unknown> } | void>) {
  return handle(() => mutate(run));
}

export function idParam(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Bad id');
  return n;
}
