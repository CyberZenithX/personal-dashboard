import { handle, mutation, readJson } from '@/lib/api';
import { query, sql } from '@/lib/db';
import { createTask } from '@/lib/ops';
import { mapTask, TASK_COLS } from '@/lib/state';
import { addDays, shortDate } from '@/lib/time';
import { optDate, optPrio, optTag, optTime, text } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await readJson(req);
  return mutation(async (c) => {
    // Only what the UI can set. XP, check-ins, source and done-state are decided by the server.
    const id = await createTask(c, {
      title: text(b.title, 'Title', 300, true) as string,
      tag: optTag(b.tag),
      dueDate: optDate(b.dueDate, 'Due date'),
      dueTime: optTime(b.dueTime, 'Due time'),
      prio: optPrio(b.prio),
      parse: !!b.parse
    });
    const r = await sql<{ d: string | null; t: string | null }>`select to_char(due_date,'YYYY-MM-DD') as d, due_time as t from tasks where id = ${id}`;
    const d = r[0]?.d ?? null;
    const where = !d ? 'no date' : d === c.today ? 'today' : d === addDays(c.today, 1) ? 'tomorrow' : shortDate(d);
    return { label: `Task added · ${where}${r[0]?.t ? ' ' + r[0].t : ''}`, data: { id } };
  });
}

/** Older finished tasks than the app loads by default: ?before=<ISO done time>. */
export function GET(req: Request) {
  return handle(async () => {
    const before = new URL(req.url).searchParams.get('before');
    const t = before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : new Date().toISOString();
    const rows = await query(`select ${TASK_COLS} from tasks where done and done_at < $1::timestamptz order by done_at desc limit 101`, [t]);
    return { items: rows.slice(0, 100).map(mapTask), more: rows.length > 100 };
  });
}
