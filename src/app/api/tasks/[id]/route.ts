import { handle, idParam, mutation, readJson } from '@/lib/api';
import { query } from '@/lib/db';
import { deleteTask, updateTask } from '@/lib/ops';
import { mapTask, TASK_COLS } from '@/lib/state';
import { BadRequest, optBool, optDate, optInt, optPrio, optTag, optTime, text } from '@/lib/validate';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: P) {
  const raw = (await params).id;
  return handle(async () => {
    const rows = await query(`select ${TASK_COLS} from tasks where id = $1`, [idParam(raw)]);
    if (!rows[0]) throw new BadRequest('Task not found');
    return mapTask(rows[0]);
  });
}

export async function PATCH(req: Request, { params }: P) {
  const raw = (await params).id;
  const b = await readJson(req);
  return mutation(async (c) => {
    const id = idParam(raw);
    const title = text(b.title, 'Title', 300);
    const done = optBool(b.done);
    const name = await updateTask(c, id, {
      title: title || undefined,
      tag: optTag(b.tag),
      dueDate: optDate(b.dueDate, 'Due date'),
      dueTime: optTime(b.dueTime, 'Due time'),
      prio: optPrio(b.prio),
      done,
      pushDays: optInt(b.pushDays, 'Push days', 1, 365)
    });
    return { label: done === true ? name : done === false && name ? `Marked not done · ${name}` : undefined };
  });
}

export async function DELETE(_req: Request, { params }: P) {
  const raw = (await params).id;
  return mutation(async (c) => {
    await deleteTask(c, idParam(raw));
  });
}
