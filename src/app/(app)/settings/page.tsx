'use client';
import { Responsive } from '@/components/Responsive';
import Desktop from '@/components/desktop/Settings';
import Phone from '@/components/phone/Settings';

export default function Page() {
  return <Responsive desktop={Desktop} phone={Phone} />;
}
