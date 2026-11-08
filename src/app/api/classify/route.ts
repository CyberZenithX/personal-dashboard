import { sortText } from '@/lib/ai';
import { handle, readJson } from '@/lib/api';
import { query } from '@/lib/db';
import { getSettings } from '@/lib/state';
import { ymd } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { text } = await readJson<{ text?: string }>(req);
  return handle(async () => {
    const settings = await getSettings();
    const today = ymd(new Date(), settings.timezone);
    const open = await query<{ id: number; title: string; tag: string | null }>(
      `select id::int as id, title, tag from tasks where not done order by id desc limit 60`
    );
    return sortText(String(text ?? '').slice(0, 4000), { settings, openTasks: open, today });
  });
}
