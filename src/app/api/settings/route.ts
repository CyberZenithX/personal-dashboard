import { handle, readJson } from '@/lib/api';
import { loadState, saveSettings } from '@/lib/state';
import type { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request) {
  const patch = await readJson<Partial<Settings>>(req);
  return handle(async () => {
    if (patch.timezone) {
      try {
        new Intl.DateTimeFormat('en-CA', { timeZone: patch.timezone });
      } catch {
        delete patch.timezone;
      }
    }
    if (patch.goal !== undefined) patch.goal = Math.min(12, Math.max(1, Math.round(Number(patch.goal) || 5)));
    await saveSettings(patch);
    return { state: await loadState() };
  });
}
