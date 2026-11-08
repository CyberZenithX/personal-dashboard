'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { rewardsAt } from '@/lib/levels';
import { Modal } from './CaptureSheet';
import { useApp } from './store';
import { C, HEAD, ICON, Pill, Svg } from './ui';

/* ------------------------------------------------------------------- toast */

export function Toast() {
  const { toast, phone } = useApp();
  if (!toast) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed', zIndex: 90, display: 'flex', alignItems: 'center', gap: phone ? 10 : 12,
        padding: phone ? '14px 16px' : '14px 18px', borderRadius: 14, background: C.accent, color: 'var(--bg)', fontWeight: 700,
        fontSize: phone ? 14 : 15, boxShadow: `0 12px 40px ${C.glow}`, animation: 'toastIn .2s ease-out',
        ...(phone ? { left: 20, right: 20, top: 'max(20px, env(safe-area-inset-top))' } : { right: 32, bottom: 32 })
      }}
    >
      <Svg d={ICON.bolt} size={phone ? 18 : 20} sw={2.5} />
      {toast}
    </div>
  );
}

/* --------------------------------------------------------------- task menu */

export function TaskMenu() {
  const { menuTaskId, openTaskMenu, state, act } = useApp();
  const task = state.tasks.find((t) => t.id === menuTaskId);
  const [title, setTitle] = useState('');
  useEffect(() => setTitle(task?.title ?? ''), [task?.id, task?.title]);
  if (!task) return null;
  const close = () => openTaskMenu(null);
  const run = async (fn: () => Promise<unknown>) => { await fn(); close(); };
  const btn = { padding: '13px 14px', borderRadius: 12, border: '1px solid #2D3240', background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600, textAlign: 'left' as const, minHeight: 48 };
  return (
    <Modal label="Task actions" onClose={close}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (title.trim() && title !== task.title) void run(() => act('PATCH', `/api/tasks/${task.id}`, { title })); else close(); }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <label htmlFor="tm-title" style={{ fontFamily: HEAD, fontSize: 18, fontWeight: 700 }}>Edit task</label>
        <input
          id="tm-title" value={title} onChange={(e) => setTitle(e.target.value)}
          style={{ padding: 14, borderRadius: 12, background: C.bg, border: '1px solid #3A404D', color: '#fff', fontSize: 16, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['high', 'med', 'low'] as const).map((p) => (
            <Pill key={p} on={task.prio === p} onClick={() => run(() => act('PATCH', `/api/tasks/${task.id}`, { prio: p }))}>
              {p === 'high' ? 'High' : p === 'med' ? 'Medium' : 'Low'} priority
            </Pill>
          ))}
        </div>
        <button type="submit" style={{ ...btn, background: C.accent, color: 'var(--bg)', border: 'none', textAlign: 'center', fontWeight: 700 }}>Save name</button>
        <button type="button" style={btn} onClick={() => run(() => act('PATCH', `/api/tasks/${task.id}`, { pushDays: 1 }))}>Push to tomorrow</button>
        <button
          type="button" style={{ ...btn, borderColor: '#5C2A24', color: '#FF9E92' }}
          onClick={() => run(() => act('DELETE', `/api/tasks/${task.id}`))}
        >
          Delete task
        </button>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- palette */

export function Palette() {
  const { palette, setPalette, state, today, phone } = useApp();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (palette) { setQ(''); setSel(0); setTimeout(() => ref.current?.focus(), 20); }
  }, [palette]);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out: { key: string; type: string; label: string; sub: string; color: string; go: () => void }[] = [];
    state.tasks.filter((t) => t.title.toLowerCase().includes(needle)).slice(0, 6).forEach((t) =>
      out.push({ key: 't' + t.id, type: 'Task', label: t.title, sub: t.done ? 'Done' : t.dueDate ?? 'No date', color: C.blue, go: () => router.push('/tasks') }));
    state.notes.filter((n) => (n.title + ' ' + n.body).toLowerCase().includes(needle)).slice(0, 6).forEach((n) =>
      out.push({ key: 'n' + n.id, type: 'Note', label: n.title, sub: n.body.slice(0, 60), color: C.amber, go: () => router.push('/notes?note=' + n.id) }));
    state.events.filter((e) => e.title.toLowerCase().includes(needle) && e.date >= today).slice(0, 4).forEach((e) =>
      out.push({ key: 'e' + e.id, type: 'Event', label: e.title, sub: e.date, color: C.purple, go: () => router.push('/calendar') }));
    return out;
  }, [q, state, today, router]);
  if (!palette) return null;
  const close = () => setPalette(false);
  const pick = (i: number) => { results[i]?.go(); close(); };
  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(5,6,8,.7)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: phone ? '12px 12px' : '12vh 16px' }}
    >
      <div role="dialog" aria-modal="true" aria-label="Search everything" style={{ width: 'min(560px, 100%)', borderRadius: 18, background: '#1C2029', border: '1px solid #3A404D', boxShadow: '0 16px 40px rgba(0,0,0,.45)', overflow: 'hidden' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: '1px solid #2D3240' }}>
          <Svg d={ICON.search} size={16} color={C.dim} sw={2.2} />
          <span style={{ position: 'absolute', left: -9999 }}>Search everything</span>
          <input
            ref={ref} value={q} placeholder="Search tasks, notes, events"
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') pick(sel);
            }}
            style={{ flex: 1, minWidth: 0, padding: '16px 0', background: 'transparent', border: 'none', color: '#fff', fontSize: 16, outline: 'none' }}
          />
        </label>
        <div role="listbox" style={{ display: 'flex', flexDirection: 'column', padding: 8, gap: 2, maxHeight: '50dvh', overflowY: 'auto' }}>
          {!q.trim() && <span style={{ padding: 12, fontSize: 13, color: C.dim }}>Start typing to search everything you’ve logged.</span>}
          {q.trim() && !results.length && <span style={{ padding: 12, fontSize: 13, color: C.dim }}>Nothing found</span>}
          {results.map((r, i) => (
            <button
              key={r.key} role="option" aria-selected={i === sel} onClick={() => pick(i)} onMouseEnter={() => setSel(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 9, border: 'none', background: i === sel ? '#262B36' : 'transparent', color: C.text, fontSize: 14, textAlign: 'left', minHeight: 44 }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
              <span style={{ fontSize: 11, color: r.color, fontWeight: 600 }}>{r.type}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- level up */

export function LevelUpScreen() {
  const { levelUp, dismissLevelUp, state, today, phone } = useApp();
  useEffect(() => {
    if (!levelUp) return;
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && dismissLevelUp();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [levelUp, dismissLevelUp]);
  if (!levelUp) return null;
  const p = state.progress;
  const day = p.days[today];
  const rewards = rewardsAt(levelUp.to);
  const stat = (v: string | number, l: string, color: string) => (
    <div style={{ padding: '14px 10px', borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 700, color }}>{v}</span>
      <span style={{ fontSize: 11, color: C.muted }}>{l}</span>
    </div>
  );
  const bits = [
    ['left:40px;top:60px', 8, 8, '#FFC85C', 2, 20], ['left:calc(100% - 70px);top:40px', 10, 6, '#D59CFF', 2, -30], ['left:80px;top:190px', 6, 6, '#7FB2FF', 99, 0],
    ['left:calc(100% - 90px);top:210px', 8, 8, C.accent, 2, 45], ['left:50%;top:10px', 6, 10, '#FFB36B', 2, 10]
  ] as const;
  return (
    <div role="dialog" aria-modal="true" aria-label="You levelled up" style={{ position: 'fixed', inset: 0, zIndex: 100, background: phone ? C.bg : 'rgba(5,6,8,.8)', display: 'flex', justifyContent: 'center', alignItems: phone ? 'stretch' : 'center', overflowY: 'auto' }}>
      <div style={{ width: phone ? '100%' : 420, minHeight: phone ? '100dvh' : undefined, background: C.bg, borderRadius: phone ? 0 : 28, border: phone ? 'none' : '1px solid #2D3240', padding: '28px 20px max(28px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', overflow: 'hidden' }}>
        {state.settings.flags.confetti && (
          <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 70, height: 300, pointerEvents: 'none' }}>
            {bits.map(([pos, w, h, bg, r, rot], i) => {
              const st: Record<string, string> = Object.fromEntries(pos.split(';').map((x) => x.split(':')));
              return <span key={i} style={{ position: 'absolute', ...st, width: w, height: h, borderRadius: r, background: bg, transform: `rotate(${rot}deg)` }} />;
            })}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 40, textAlign: 'center' }}>
          <div style={{ width: 132, height: 132, borderRadius: 36, background: C.accent, color: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'pop .7s ease-out both', boxShadow: '0 20px 60px var(--accent-glow2)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em' }}>LEVEL</span>
            <span style={{ fontFamily: HEAD, fontSize: 60, fontWeight: 700, lineHeight: 1 }}>{levelUp.to}</span>
          </div>
          <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 28 }}>You levelled up</h1>
          <p style={{ margin: 0, fontSize: 14, color: C.muted, lineHeight: 1.5, maxWidth: 280 }}>
            New title: <strong style={{ color: '#FFFFFF' }}>{p.title}</strong>. You logged {p.thingsThisWeek} thing{p.thingsThisWeek === 1 ? '' : 's'} this week.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {stat(p.streak, 'day streak', C.orange)}
          {stat(day?.score ?? 0, 'day score', C.accent)}
          {stat('+' + p.xpToday, 'XP today', C.blue)}
        </div>
        <div style={{ padding: 16, borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Unlocked</span>
          {rewards.map((r) => (
            <div key={r.title} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: r.icon === 'theme' ? '#2A1C33' : '#2A1D12', color: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                {r.icon === 'theme' ? <span style={{ width: 18, height: 18, borderRadius: 99, background: C.purple }} /> : <Svg d={ICON.star} size={20} />}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{r.sub}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted }}>
            <span>Level {levelUp.to}</span><span>{p.xp.toLocaleString()} / {p.nextXp.toLocaleString()} XP</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: '#262B36', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: Math.min(100, Math.round(((p.xp - p.levelXp) / Math.max(1, p.nextXp - p.levelXp)) * 100)) + '%', background: C.accent }} />
          </div>
        </div>
        <button autoFocus type="button" onClick={dismissLevelUp} style={{ marginTop: 'auto', padding: 16, borderRadius: 16, background: C.accent, color: 'var(--bg)', border: 'none', textAlign: 'center', fontWeight: 700, fontSize: 16 }}>
          Keep going
        </button>
      </div>
    </div>
  );
}
