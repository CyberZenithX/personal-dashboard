import { idParam, mutation, readJson } from '@/lib/api';
import { deleteTask, updateTask, type TaskPatch } from '@/lib/ops';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: P) {
  const id = idParam((await params).id);
  const body = await readJson<TaskPatch>(req);
  return mutation(async (c) => ({ label: await updateTask(c, id, body) }));
}

export async function DELETE(_req: Request, { params }: P) {
  const id = idParam((await params).id);
  return mutation(async (c) => {
    await deleteTask(c, id);
  });
}
