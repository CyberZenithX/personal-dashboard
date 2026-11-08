import { AppProvider } from '@/components/store';
import { Shell } from '@/components/Shell';
import { loadState } from '@/lib/state';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const state = await loadState();
  return (
    <AppProvider initial={state}>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
