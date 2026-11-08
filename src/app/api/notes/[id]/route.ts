import { idParam, mutation, readJson } from '@/lib/api';
import { deleteNote, updateNote, type NotePatch } from '@/lib/ops';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: P) {
  const id = idParam((await params).id);
  const body = await readJson<NotePatch>(req);
  return mutation(async (c) => {
    await updateNote(c, id, body);
    return { label: body.toTask ? 'Task created' : undefined };
  });
}

export async function DELETE(_req: Request, { params }: P) {
  const id = idParam((await params).id);
  return mutation(async (c) => {
    await deleteNote(c, id);
  });
}
