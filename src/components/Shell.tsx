'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { CaptureSheet } from './CaptureSheet';
import { comboFromEvent, keyState } from './keys';
import { PhoneTabs } from './Nav';
import DesktopVoice from './desktop/Voice';
import PhoneVoice from './phone/Voice';
import { LevelUpScreen, Palette, TaskMenu, Toast } from './Overlays';
import { Presence, useRouteSettle } from './motion';
import { useApp } from './store';
import { C } from './ui';
import { hhmmToMin, minutesOfDay } from '@/lib/time';

const PAGE_FLAG: Record<string, 'Tasks' | 'Notes' | 'Calendar'> = { '/tasks': 'Tasks', '/notes': 'Notes', '/calendar': 'Calendar' };
/** Which tab is highlighted on each page. Pages without one (Calendar, Settings) still show the bar. */
const PHONE_TAB: Record<string, string> = { '/': 'Today', '/tasks': 'Tasks', '/notes': 'Notes', '/progress': 'Progress' };

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

function isControl(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el?.closest?.('button, a[href], summary, [role="button"], [role="switch"], [role="tab"], [role="option"], [role="radio"], [role="checkbox"], [role="menuitem"]');
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
      // Space and Enter press the focused button/link/switch — never steal them from it.
      if ((e.key === ' ' || e.key === 'Enter') && !hasModifier && isControl(e.target)) return;
      if (document.querySelector('[aria-modal="true"]') && idx !== 6) return;
      const sel = app.selectedTask;
      switch (idx) {
        case 0: e.preventDefault(); app.openCapture({ type: 'task' }); break;
        case 1: e.preventDefault(); app.openCapture({ type: 'note' }); break;
        case 2: e.preventDefault(); app.openCapture({ type: 'event' }); break;
        case 3: if (pathname !== '/voice' && !app.voiceOpen) { e.preventDefault(); app.openVoice(); } break;
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
  // Permission is asked from Settings (a click), never on page load.
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
        // anything you did counts: adding or finishing a task, a note, a voice log
        const lastLog = Math.max(
          0,
          ...state.tasks.map((t) => Math.max(Date.parse(t.createdAt), t.doneAt ? Date.parse(t.doneAt) : 0)),
          ...state.notes.map((n) => Math.max(Date.parse(n.createdAt), Date.parse(n.updatedAt))),
          ...state.voiceLogs.map((v) => Date.parse(v.createdAt))
        );
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

function VoiceOverlay({ phone, onClose }: { phone: boolean; onClose: () => void }) {
  // Lock the page behind so it doesn't scroll under the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div data-anim="dialog" style={{ position: 'fixed', inset: 0, zIndex: 85, overflowY: 'auto' }}>
      {phone ? <PhoneVoice onClose={onClose} overlay /> : <DesktopVoice onClose={onClose} overlay />}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const app = useApp();
  const router = useRouter();
  const pathname = usePathname();
  useShortcuts();
  useReminders();
  useRouteSettle(pathname);
  // CSS hooks for page transitions: desktop or phone, and whether the browser can do view transitions
  useEffect(() => {
    const r = document.documentElement;
    if (app.phone !== null) r.dataset.form = app.phone ? 'phone' : 'desk';
    r.classList.toggle('no-vt', !('startViewTransition' in document));
  }, [app.phone]);

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
      {app.phone && pathname !== '/voice' && <PhoneTabs active={tab} />}
      <CaptureSheet />
      <TaskMenu />
      <Palette />
      <Presence show={app.voiceOpen && pathname !== '/voice'}>
        <VoiceOverlay phone={app.phone} onClose={app.closeVoice} />
      </Presence>
      <Toast />
      <LevelUpScreen />
    </div>
  );
}
