'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { THEMES } from '@/lib/settings';
import { ymd } from '@/lib/time';
import type { AppState, EventItem, LevelUp, MutationResult, Settings } from '@/lib/types';

export type CaptureReq =
  | { type: 'task'; title?: string; tag?: string }
  | { type: 'note'; title?: string; body?: string; evening?: boolean }
  | { type: 'event'; title?: string; date?: string; linkNoteId?: number; edit?: EventItem };

type SettingsPatch = Partial<Omit<Settings, 'pages' | 'flags'>> & { pages?: Partial<Settings['pages']>; flags?: Partial<Settings['flags']> };

interface Store {
  state: AppState;
  /** null until the first client render, then true on phones / false on desktop */
  phone: boolean | null;
  today: string;
  tz: string;
  saveState: 'saved' | 'saving';
  toast: string | null;
  flash: (msg: string) => void;
  levelUp: LevelUp | null;
  dismissLevelUp: () => void;
  capture: CaptureReq | null;
  openCapture: (r: CaptureReq) => void;
  closeCapture: () => void;
  menuTaskId: number | null;
  openTaskMenu: (id: number | null) => void;
  palette: boolean;
  setPalette: (v: boolean) => void;
  selectedTask: number | null;
  setSelectedTask: (id: number | null) => void;
  act: (method: 'POST' | 'PATCH' | 'DELETE' | 'PUT', url: string, body?: unknown) => Promise<MutationResult | null>;
  setSettings: (patch: SettingsPatch) => void;
  toggleTask: (id: number) => void;
}

const Ctx = createContext<Store | null>(null);

export function useApp(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useApp outside AppProvider');
  return s;
}

export function playClick() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.07);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close(), 300);
  } catch {
    /* audio is optional */
  }
}

export function AppProvider({ initial, children }: { initial: AppState; children: ReactNode }) {
  const [state, setState] = useState<AppState>(initial);
  const [phone, setPhone] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState<LevelUp | null>(null);
  const [capture, setCapture] = useState<CaptureReq | null>(null);
  const [menuTaskId, setMenuTaskId] = useState<number | null>(null);
  const [palette, setPalette] = useState(false);
  const [selectedTask, setSelectedTask] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [clock, setClock] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingPatch = useRef<SettingsPatch>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inflight = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 819px)');
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Keep "today" fresh across midnight / when the app is resumed.
  useEffect(() => {
    const t = setInterval(() => setClock((c) => c + 1), 30000);
    const vis = () => {
      if (document.visibilityState === 'visible') {
        setClock((c) => c + 1);
        fetch('/api/state', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .then((s: AppState | null) => s && !inflight.current && setState(s))
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  const tz = state.settings.timezone;
  const today = useMemo(() => ymd(new Date(), tz), [tz, clock, state.today]); // eslint-disable-line react-hooks/exhaustive-deps

  // Theme + density
  useEffect(() => {
    const th = THEMES.find((t) => t.name === state.settings.theme) ?? THEMES[0];
    const r = document.documentElement;
    r.style.setProperty('--bg', th.bg);
    r.style.setProperty('--accent', th.accent);
    r.style.setProperty('--accent2', th.accent2);
    r.dataset.density = state.settings.density === 'Compact' ? 'compact' : 'comfortable';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', th.bg);
  }, [state.settings.theme, state.settings.density]);

  const flash = useCallback((msg: string) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const act = useCallback<Store['act']>(
    async (method, url, body) => {
      inflight.current++;
      try {
        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        if (res.status === 401) {
          window.location.href = '/login';
          return null;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed');
        const r = json as MutationResult;
        setState(r.state);
        if (r.toast) flash(r.toast);
        if (r.levelUp) setLevelUp(r.levelUp);
        if (r.toast && stateRef.current.settings.flags.sounds) playClick();
        return r;
      } catch (err) {
        flash(err instanceof Error ? err.message : 'Something went wrong');
        // resync after a failed optimistic change
        fetch('/api/state', { cache: 'no-store' }).then((r) => r.json()).then(setState).catch(() => {});
        return null;
      } finally {
        inflight.current--;
      }
    },
    [flash]
  );

  const setSettings = useCallback((patch: SettingsPatch) => {
    setState((s) => ({
      ...s,
      settings: {
        ...s.settings, ...patch,
        pages: { ...s.settings.pages, ...(patch.pages ?? {}) },
        flags: { ...s.settings.flags, ...(patch.flags ?? {}) }
      } as Settings
    }));
    const p = pendingPatch.current;
    pendingPatch.current = {
      ...p, ...patch,
      ...(patch.pages ? { pages: { ...(p.pages ?? {}), ...patch.pages } } : {}),
      ...(patch.flags ? { flags: { ...(p.flags ?? {}), ...patch.flags } } : {})
    };
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const body = pendingPatch.current;
      pendingPatch.current = {};
      inflight.current++;
      try {
        const res = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (res.ok && !Object.keys(pendingPatch.current).length) setState(json.state);
        if (!res.ok) throw new Error(json.error);
        setSaveState(Object.keys(pendingPatch.current).length ? 'saving' : 'saved');
      } catch {
        flash("Couldn't save settings");
        setSaveState('saved');
      } finally {
        inflight.current--;
      }
    }, 450);
  }, [flash]);

  // Remember the browser's timezone the first time (or when travelling).
  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browser && browser !== initial.settings.timezone) setSettings({ timezone: browser });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTask = useCallback(
    (id: number) => {
      const t = stateRef.current.tasks.find((x) => x.id === id);
      if (!t) return;
      const done = !t.done;
      setState((s) => ({
        ...s,
        tasks: s.tasks.map((x) => (x.id === id ? { ...x, done, doneAt: done ? new Date().toISOString() : null } : x))
      }));
      void act('PATCH', `/api/tasks/${id}`, { done });
    },
    [act]
  );

  const value: Store = {
    state, phone, today, tz, saveState, toast, flash, levelUp,
    dismissLevelUp: () => setLevelUp(null),
    capture, openCapture: setCapture, closeCapture: () => setCapture(null),
    menuTaskId, openTaskMenu: setMenuTaskId, palette, setPalette,
    selectedTask, setSelectedTask, act, setSettings, toggleTask
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
