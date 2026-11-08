'use client';
import { Responsive } from '@/components/Responsive';
import Desktop from '@/components/desktop/Notes';
import Phone from '@/components/phone/Notes';

export default function Page() {
  return <Responsive desktop={Desktop} phone={Phone} />;
}
