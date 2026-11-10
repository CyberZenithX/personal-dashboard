import { idParam, mutation, readJson } from '@/lib/api';
import { deleteEvent, updateEvent } from '@/lib/ops';
import { optDate, optDays, optKind, optTime, text } from '@/lib/validate';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: P) {
  const raw = (await params).id;
  const b = await readJson(req);
  return mutation(async (c) => {
    const date = optDate(b.date);
    await updateEvent(c, idParam(raw), {
      title: text(b.title, 'Title', 300) || undefined,
      kind: optKind(b.kind),
      date: date ?? undefined,
      start: optTime(b.start, 'Start time') ?? undefined,
      end: optTime(b.end, 'End time') ?? undefined,
      repeatDays: optDays(b.repeatDays)
    });
  });
}

export async function DELETE(_req: Request, { params }: P) {
  const raw = (await params).id;
  return mutation(async (c) => {
    await deleteEvent(c, idParam(raw));
  });
}
