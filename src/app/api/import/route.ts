import { mutation, readJson } from '@/lib/api';
import { importTasks } from '@/lib/ops';
import type { Prio } from '@/lib/types';
import { isYmd, normTime, optTag } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await readJson(req);
  const raw = Array.isArray(b.tasks) ? (b.tasks as Record<string, unknown>[]).slice(0, 500) : [];
  // Be forgiving with imported files: drop bad values instead of failing the whole import.
  const rows = raw
    .map((r) => {
      let tag: string | null = null;
      try { tag = optTag(r?.tag) ?? null; } catch { /* unusable tag */ }
      return {
        title: typeof r?.title === 'string' ? r.title.trim().slice(0, 300) : '',
        dueDate: isYmd(r?.dueDate) ? (r.dueDate as string) : null,
        dueTime: isYmd(r?.dueDate) ? normTime(r?.dueTime) : null,
        prio: (['high', 'med', 'low'].includes(r?.prio as string) ? r.prio : 'low') as Prio,
        tag,
        done: !!r?.done
      };
    })
    .filter((r) => r.title);
  return mutation(async (c) => {
    const n = await importTasks(c, rows);
    return { label: `Imported ${n} task${n === 1 ? '' : 's'}`, data: { imported: n, skipped: raw.length - n } };
  });
}
