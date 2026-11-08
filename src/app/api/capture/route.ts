import { mutation, readJson } from '@/lib/api';
import { captureItems } from '@/lib/ops';
import type { SortItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { transcript, items } = await readJson<{ transcript?: string; items?: SortItem[] }>(req);
  return mutation(async (c) => {
    const { saved } = await captureItems(c, String(transcript ?? '').slice(0, 4000), Array.isArray(items) ? items.slice(0, 30) : []);
    return { label: `Voice log · ${saved} item${saved === 1 ? '' : 's'}`, data: { saved } };
  });
}
