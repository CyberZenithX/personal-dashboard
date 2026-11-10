import { mutation, readJson } from '@/lib/api';
import { createEvent } from '@/lib/ops';
import { BadRequest, optDate, optDays, optInt, optKind, optTime, text } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await readJson(req);
  return mutation(async (c) => {
    const date = optDate(b.date);
    if (!date) throw new BadRequest('Pick a date for the event');
    const id = await createEvent(c, {
      title: text(b.title, 'Title', 300, true) as string,
      kind: optKind(b.kind),
      date,
      start: optTime(b.start, 'Start time') ?? '09:00',
      end: optTime(b.end, 'End time'),
      repeatDays: optDays(b.repeatDays),
      linkNoteId: optInt(b.linkNoteId, 'Note id', 1, 2 ** 31 - 1)
    });
    return { label: 'Event added', data: { id } };
  });
}
