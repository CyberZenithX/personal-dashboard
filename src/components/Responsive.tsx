'use client';
import type { ComponentType } from 'react';
import { useApp } from './store';

/** Picks the desktop or phone screen for the current viewport. */
export function Responsive({ desktop: Desktop, phone: Phone }: { desktop: ComponentType; phone: ComponentType }) {
  const { phone } = useApp();
  return phone ? <Phone /> : <Desktop />;
}
