import { mutation, readJson } from '@/lib/api';
import { sql } from '@/lib/db';
import { createTask, type TaskInput } from '@/lib/ops';
import { addDays, shortDate } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await readJson<TaskInput>(req);
  return mutation(async (c) => {
    const id = await createTask(c, body);
    const r = await sql<{ d: string | null; t: string | null }>`select to_char(due_date,'YYYY-MM-DD') as d, due_time as t from tasks where id = ${id}`;
    const d = r[0]?.d ?? null;
    const where = !d ? 'no date' : d === c.today ? 'today' : d === addDays(c.today, 1) ? 'tomorrow' : shortDate(d);
    return { label: `Task added · ${where}${r[0]?.t ? ' ' + r[0].t : ''}`, data: { id } };
  });
}
