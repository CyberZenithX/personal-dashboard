'use client';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/store';
import Desktop from '@/components/desktop/Voice';
import Phone from '@/components/phone/Voice';

/** Standalone voice page (the app's "Just say it" home-screen shortcut). Inside the app voice opens as an overlay. */
export default function Page() {
  const { phone } = useApp();
  const router = useRouter();
  const done = () => router.push('/');
  return phone ? <Phone onClose={done} /> : <Desktop onClose={done} />;
}
