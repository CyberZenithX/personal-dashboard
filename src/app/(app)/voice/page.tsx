'use client';
import { Responsive } from '@/components/Responsive';
import Desktop from '@/components/desktop/Voice';
import Phone from '@/components/phone/Voice';

export default function Page() {
  return <Responsive desktop={Desktop} phone={Phone} />;
}
