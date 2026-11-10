import { mutation, readJson } from '@/lib/api';
import { captureItems } from '@/lib/ops';
import { sortItems, text } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = await readJson(req);
  return mutation(async (c) => {
    const transcript = (text(b.transcript, 'Transcript', 100000) ?? '').slice(0, 4000);
    const { saved } = await captureItems(c, transcript, sortItems(b.items));
    return { label: `Voice log · ${saved} item${saved === 1 ? '' : 's'}`, data: { saved } };
  });
}
