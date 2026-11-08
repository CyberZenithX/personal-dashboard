'use client';
import { Responsive } from '@/components/Responsive';
import Desktop from '@/components/desktop/Tasks';
import Phone from '@/components/phone/Tasks';

export default function Page() {
  return <Responsive desktop={Desktop} phone={Phone} />;
}
