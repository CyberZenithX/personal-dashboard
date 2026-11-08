'use client';
import { Responsive } from '@/components/Responsive';
import Desktop from '@/components/desktop/Today';
import Phone from '@/components/phone/Today';

export default function Page() {
  return <Responsive desktop={Desktop} phone={Phone} />;
}
