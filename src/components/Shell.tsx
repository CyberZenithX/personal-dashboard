'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { CaptureSheet } from './CaptureSheet';
import { comboFromEvent, keyState } from './keys';
import { PhoneTabs } from './Nav';
import { LevelUpScreen, Palette, TaskMenu, Toast } from './Overlays';
import { useApp } from './store';
import { C } from './ui';
import { hhmmToMin, minutesOfDay } from '@/lib/time';

const PAGE_FLAG: Record<string, 'Tasks' | 'Notes' | 'Calendar'> = { '/tasks': 'Tasks', '/notes': 'Notes', '/calendar': 'Calendar' };
const PHONE_TAB: Record<string, string> = { '/tasks': 'Tasks', '/notes': 'Notes', '/progress': 'Progress' };

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

/** Global keyboard shortcuts (bindings come from Settings → Shortcuts). */
function useShortcuts() {
  const app = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef({ app, router, pathname });
  ref.current = { app, router, pathname };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { app, router, pathname } = ref.current;
      if (keyState.recording || e.repeat) return;
      const combo = comboFromEvent(e);
      if (!combo) return;
      const keys = app.state.settings.keys;
      const idx = keys.indexOf(combo);
      if (idx < 0) return;
      const typing = isTyping(e.target);
      const hasModifier = combo.includes('Ctrl') || combo.includes('Alt');
      if (typing && !hasModifier) return;
      if (document.querySelector('[aria-modal="true"]') && idx !== 6) return;
      const sel = app.selectedTask;
      switch (idx) {
        case 0: e.preventDefault(); app.openCapture({ type: 'task' }); break;
        case 1: e.preventDefault(); app.openCapture({ type: 'note' }); break;
        case 2: e.preventDefault(); app.openCapture({ type: 'event' }); break;
        case 3: if (pathname !== '/voice') { e.preventDefault(); router.push('/voice'); } break;
        case 4: if (sel) { e.preventDefault(); app.toggleTask(sel); } break;
        case 5: if (sel) { e.preventDefault(); void app.act('PATCH', `/api/tasks/${sel}`, { pushDays: 1 }); } break;
        case 6: e.preventDefault(); app.setPalette(!app.palette); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** In-app reminders (fire while Daylog is open): evening check-in, inactivity nudge, Sunday review. */
function useReminders() {
  const { state, tz, today } = useApp();
  const ref = useRef({ state, tz, today });
  ref.current = { state, tz, today };
  const f = state.settings.flags;
  useEffect(() => {
    if ((f.nudges || f.evening || f.weekly) && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission().catch(() => {});
    }
  }, [f.nudges, f.evening, f.weekly]);
  useEffect(() => {
    const fire = (key: string, title: string, body: string) => {
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, '1');
      } catch { /* private mode */ }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, icon: '/icon.svg' });
    };
    const tick = () => {
      const { state, tz, today } = ref.current;
      const { flags, eveningTime } = state.settings;
      const now = new Date();
      const min = minutesOfDay(now, tz);
      const evening = hhmmToMin(eveningTime) ?? 1260;
      if (flags.evening && min >= evening && min < evening + 120) fire(`dl-evening-${today}`, 'Evening check-in', 'What was the best part of today?');
      if (flags.nudges && min >= 9 * 60 && min <= 21 * 60) {
        const lastLog = Math.max(0, ...state.tasks.map((t) => Date.parse(t.createdAt)), ...state.notes.map((n) => Date.parse(n.createdAt)), ...state.voiceLogs.map((v) => Date.parse(v.createdAt)));
        if (Date.now() - lastLog > 4 * 3600000) fire(`dl-nudge-${today}-${Math.floor(min / 240)}`, 'Daylog', 'Nothing logged for a while. What’s happening right now?');
      }
      if (flags.weekly && new Date(now.toLocaleString('en-US', { timeZone: tz })).getDay() === 0 && min >= 18 * 60) {
        fire(`dl-weekly-${today}`, 'Weekly review', 'Take a minute to look back at your week.');
      }
    };
    const t = setInterval(tick, 60000);
    tick();
    return () => clearInterval(t);
  }, []);
}

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const router = useRouter();
  const pathname = usePathname();
  useShortcuts();
  useReminders();

  const flag = PAGE_FLAG[pathname];
  const disabled = !!flag && !app.state.settings.pages[flag];
  useEffect(() => {
    if (disabled) router.replace('/');
  }, [disabled, router]);

  if (app.phone === null || disabled) return <div style={{ minHeight: '100dvh', background: C.bg }} />;
  const tab = PHONE_TAB[pathname];
  return (
    <div className={app.phone ? 'phone' : undefined} style={{ minHeight: '100dvh', background: C.bg, color: C.text }}>
      {children}
      {app.phone && tab && <PhoneTabs active={tab} />}
      <CaptureSheet />
      <TaskMenu />
      <Palette />
      <Toast />
      <LevelUpScreen />
    </div>
  );
}
