import { mutation, readJson } from '@/lib/api';
import { createTask, type TaskInput } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await readJson<TaskInput>(req);
  return mutation(async (c) => {
    const id = await createTask(c, body);
    return { label: 'Task added', data: { id } };
  });
}
