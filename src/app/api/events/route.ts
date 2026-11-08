import { mutation, readJson } from '@/lib/api';
import { createEvent, type EventInput } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await readJson<EventInput>(req);
  return mutation(async (c) => {
    const id = await createEvent(c, body);
    return { label: 'Event added', data: { id } };
  });
}
