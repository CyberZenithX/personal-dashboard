import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { LISTEN_MODEL_IDS } from '@/lib/settings';
import { getSettings } from '@/lib/state';

export const dynamic = 'force-dynamic';

/**
 * Mints a short-lived, single-use Gemini Live token for the browser, so GEMINI_API_KEY itself never
 * leaves the server. (The route sits behind the password middleware.)
 */
export async function POST() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'Gemini is not configured' }, { status: 503 });
  return handle(async () => {
    const settings = await getSettings();
    const model = process.env.GEMINI_LIVE_MODEL || LISTEN_MODEL_IDS[settings.listenModel] || LISTEN_MODEL_IDS['Gemini 3 Flash Live'];
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
    return { token: json.name, model, textOnly: /transcribe/i.test(model) };
  });
}
