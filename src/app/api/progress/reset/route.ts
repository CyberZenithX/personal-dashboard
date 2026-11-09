import { mutation } from '@/lib/api';
import { resetProgress } from '@/lib/ops';

export const dynamic = 'force-dynamic';

export function POST() {
  return mutation(async (c) => {
    await resetProgress(c);
    return { label: 'Progress reset' };
  });
}
