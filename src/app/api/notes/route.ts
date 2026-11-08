import { mutation, readJson } from '@/lib/api';
import { createNote, type NoteInput } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await readJson<NoteInput>(req);
  return mutation(async (c) => {
    const id = await createNote(c, body);
    return { label: 'Note saved', data: { id } };
  });
}
