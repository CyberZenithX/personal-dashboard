import { handle, mutation, readJson } from '@/lib/api';
import { query } from '@/lib/db';
import { createNote } from '@/lib/ops';
import { mapNote, NOTE_COLS } from '@/lib/state';
import { BadRequest, optTag, text } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await readJson(req);
  return mutation(async (c) => {
    const title = text(b.title, 'Title', 200) ?? '';
    const body = text(b.body, 'Note', 20000) ?? '';
    if (!title && !body) throw new BadRequest('Write a title or some text');
    const id = await createNote(c, { title, body, tag: optTag(b.tag), source: b.source === 'evening' ? 'evening' : 'typed' });
    return { label: 'Note saved', data: { id } };
  });
}

/** Notes older than the app loads by default: ?before=<ISO created time>. */
export function GET(req: Request) {
  return handle(async () => {
    const before = new URL(req.url).searchParams.get('before');
    const t = before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : new Date().toISOString();
    const rows = await query(`select ${NOTE_COLS} from notes where created_at < $1::timestamptz order by created_at desc limit 101`, [t]);
    return { items: rows.slice(0, 100).map(mapNote), more: rows.length > 100 };
  });
}
