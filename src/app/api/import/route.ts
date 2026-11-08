import { mutation, readJson } from '@/lib/api';
import { importTasks } from '@/lib/ops';
import type { Prio } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { tasks } = await readJson<{
    tasks?: { title: string; dueDate?: string | null; dueTime?: string | null; prio?: Prio; tag?: string | null; done?: boolean }[];
  }>(req);
  return mutation(async (c) => {
    const n = await importTasks(c, Array.isArray(tasks) ? tasks : []);
    return { data: { imported: n } };
  });
}
