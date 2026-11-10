'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { THEMES } from '@/lib/settings';
import { ymd } from '@/lib/time';
import type { AppState, EventItem, LevelUp, MutationResult, Note, Settings, Task } from '@/lib/types';

function mergeById<T extends { id: number }>(fresh: T[], extra: T[]): T[] {
  if (!extra.length) return fresh;
  const ids = new Set(fresh.map((x) => x.id));
  return [...fresh, ...extra.filter((x) => !ids.has(x.id))];
}

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
  /** Voice capture opens as an overlay on top of the current page. */
  voiceOpen: boolean;
  openVoice: () => void;
  closeVoice: () => void;
  selectedTask: number | null;
  setSelectedTask: (id: number | null) => void;
  act: (method: 'POST' | 'PATCH' | 'DELETE' | 'PUT', url: string, body?: unknown) => Promise<MutationResult | null>;
  setSettings: (patch: SettingsPatch) => void;
  toggleTask: (id: number) => void;
  /** Recent notes plus any older ones loaded with loadOlder('notes'). */
  allNotes: Note[];
  /** Tasks in the app state plus older finished ones loaded with loadOlder('tasks'). */
  allTasks: Task[];
  loadOlder: (kind: 'notes' | 'tasks') => Promise<void>;
  moreNotes: boolean;
  moreTasks: boolean;
}

interface Older { notes: Note[]; tasks: Task[]; notesMore: boolean; tasksMore: boolean }

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
  const [voiceOpen, setVoiceOpen] = useState(false);
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

  // The day rolled over while the tab stayed open: XP today, quests and the streak come from the
  // server, so fetch them again. If the server hasn't reached midnight yet, retry once a minute later.
  useEffect(() => {
    if (today <= state.today) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const refresh = (again: boolean) =>
      fetch('/api/state', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((s: AppState | null) => {
          if (s && !inflight.current) setState(s);
          if (again && (!s || s.today < today)) retry = setTimeout(() => void refresh(false), 60000);
        })
        .catch(() => {});
    void refresh(true);
    return () => clearTimeout(retry);
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /** Sends the queued settings change now (if any). Resolves once it has been saved or failed. */
  const saveSettingsNow = useRef<() => Promise<void>>(async () => {});
  saveSettingsNow.current = async () => {
    clearTimeout(saveTimer.current);
    const body = pendingPatch.current;
    if (!Object.keys(body).length) return;
    pendingPatch.current = {};
    inflight.current++;
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Couldn't save settings");
      if (!Object.keys(pendingPatch.current).length) setState(json.state);
      setSaveState(Object.keys(pendingPatch.current).length ? 'saving' : 'saved');
    } catch (err) {
      flash(err instanceof Error ? err.message : "Couldn't save settings");
      setSaveState('saved');
      // put the screen back to what the server actually has
      fetch('/api/state', { cache: 'no-store' }).then((r) => r.json()).then(setState).catch(() => {});
    } finally {
      inflight.current--;
    }
  };

  const act = useCallback<Store['act']>(
    async (method, url, body) => {
      // A settings change still waiting to be sent goes first, so it can't overwrite this write afterwards.
      await saveSettingsNow.current();
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
        const json = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
        if (!res.ok) throw new Error(json.error || 'Request failed');
        const r = json as MutationResult;
        setState(r.state);
        if (r.toast) flash(r.toast);
        if (r.levelUp) setLevelUp(r.levelUp);
        if (r.toast && stateRef.current.settings.flags.sounds) playClick();
        // keep "older" items (loaded on demand) in step with edits
        const m = /^\/api\/(notes|tasks)\/(\d+)$/.exec(url);
        if (m) {
          const kind = m[1] as 'notes' | 'tasks';
          const id = Number(m[2]);
          if (olderRef.current[kind].some((x) => x.id === id)) {
            if (method === 'DELETE') setOlder((o) => ({ ...o, [kind]: o[kind].filter((x) => x.id !== id) }));
            else {
              fetch(url, { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).then((item) => {
                if (item) setOlder((o) => ({ ...o, [kind]: o[kind].map((x) => (x.id === id ? item : x)) }));
              }).catch(() => {});
            }
          }
        }
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
    saveTimer.current = setTimeout(() => void saveSettingsNow.current(), 450);
  }, []);

  /* ---- older notes / finished tasks, loaded on demand (the app state only carries recent ones) */
  const [older, setOlder] = useState<Older>({ notes: [], tasks: [], notesMore: true, tasksMore: true });
  const olderRef = useRef(older);
  olderRef.current = older;
  const loadOlder = useCallback(async (kind: 'notes' | 'tasks') => {
    const s = stateRef.current;
    const o = olderRef.current;
    const pool = kind === 'notes'
      ? [...s.notes, ...o.notes].map((n) => n.createdAt)
      : [...s.tasks, ...o.tasks].filter((t) => t.done && t.doneAt).map((t) => t.doneAt as string);
    const before = pool.length ? pool.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString();
    try {
      const res = await fetch(`/api/${kind}?before=${encodeURIComponent(before)}`, { cache: 'no-store' });
      const json = (await res.json()) as { items: (Note | Task)[]; more: boolean };
      if (!res.ok) throw new Error();
      setOlder((x) => ({
        ...x,
        [kind]: [...x[kind], ...json.items.filter((it) => !(x[kind] as { id: number }[]).some((y) => y.id === it.id))],
        [kind === 'notes' ? 'notesMore' : 'tasksMore']: json.more
      }));
      if (!json.items.length) flash(kind === 'notes' ? 'No older notes' : 'No older finished tasks');
    } catch {
      flash("Couldn't load older items");
    }
  }, [flash]);


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
    voiceOpen, openVoice: () => { setCapture(null); setPalette(false); setVoiceOpen(true); }, closeVoice: () => setVoiceOpen(false),
    selectedTask, setSelectedTask, act, setSettings, toggleTask,
    allNotes: mergeById(state.notes, older.notes),
    allTasks: mergeById(state.tasks, older.tasks),
    loadOlder,
    // the server sends at most 300 notes; anything less means we already have them all
    moreNotes: older.notesMore && state.notes.length >= 300,
    moreTasks: older.tasksMore
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
