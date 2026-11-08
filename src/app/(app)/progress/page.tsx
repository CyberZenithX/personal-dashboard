'use client';
import { Responsive } from '@/components/Responsive';
import Desktop from '@/components/desktop/Progress';
import Phone from '@/components/phone/Progress';

export default function Page() {
  return <Responsive desktop={Desktop} phone={Phone} />;
}
