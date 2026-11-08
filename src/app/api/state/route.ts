import { handle } from '@/lib/api';
import { loadState } from '@/lib/state';

export const dynamic = 'force-dynamic';

export function GET() {
  return handle(loadState);
}
