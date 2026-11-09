import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { LISTEN_MODELS, LISTEN_MODEL_IDS } from '@/lib/settings';
import { getSettings } from '@/lib/state';

export const dynamic = 'force-dynamic';

/**
 * Mints a short-lived, single-use Gemini Live token for the browser, so GEMINI_API_KEY itself never
 * leaves the server. (The route sits behind the password middleware.)
 */
export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'Gemini is not configured' }, { status: 503 });
  const res = await handle(async () => {
    const settings = await getSettings();
    const body = (await req.json().catch(() => ({}))) as { attempt?: number };
    const attempt = Math.max(0, Math.floor(Number(body.attempt) || 0));
    // Main model first (Settings → Listening model), then the other Live models as fallbacks.
    const chain = process.env.GEMINI_LIVE_MODEL
      ? [{ label: 'Custom Live model', id: process.env.GEMINI_LIVE_MODEL }]
      : [settings.listenModel, ...LISTEN_MODELS.filter((m) => m !== settings.listenModel)]
          .filter((m) => LISTEN_MODEL_IDS[m])
          .map((m) => ({ label: m, id: LISTEN_MODEL_IDS[m] }));
    const pick = chain[attempt];
    if (!pick) throw new Error('NO_MORE_MODELS');
    const model = pick.id;
    const now = Date.now();
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        uses: 1,
        expireTime: new Date(now + 10 * 60000).toISOString(),
        newSessionExpireTime: new Date(now + 60000).toISOString()
      }),
      signal: AbortSignal.timeout(8000)
    });
    const json = (await res.json().catch(() => ({}))) as { name?: string; error?: { message?: string } };
    if (!res.ok || !json.name) throw new Error(json.error?.message || `Token request failed (${res.status})`);
    return { token: json.name, model, label: pick.label, textOnly: /transcribe/i.test(model), attempt, last: attempt >= chain.length - 1 };
  });
  if (res.status === 500) {
    const j = (await res.clone().json().catch(() => ({}))) as { error?: string };
    if (j.error === 'NO_MORE_MODELS') return NextResponse.json({ error: 'No more Live models to try' }, { status: 404 });
  }
  return res;
}
