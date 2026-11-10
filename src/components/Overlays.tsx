'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { rewardsAt } from '@/lib/levels';
import { addDays, dow } from '@/lib/time';
import type { LevelUp, Task } from '@/lib/types';
import { allTagColor } from '@/lib/view';
import { Modal } from './CaptureSheet';
import { Count, Presence, useNav } from './motion';
import { useApp } from './store';
import { C, HEAD, ICON, Pill, Svg, useDialogFocus } from './ui';

/* ------------------------------------------------------------------- toast */

export function Toast() {
  const { toast, phone } = useApp();
  return (
    <Presence show={!!toast}>
    <div
      role="status" data-anim="toast"
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
    </Presence>
  );
}

/* --------------------------------------------------------------- task menu */

export function TaskMenu() {
  const { menuTaskId, openTaskMenu, allTasks } = useApp();
  const task = allTasks.find((t) => t.id === menuTaskId);
  return <Presence show={!!task}>{task && <TaskEditor key={task.id} task={task} onClose={() => openTaskMenu(null)} />}</Presence>;
}

type When = 'none' | 'today' | 'tomorrow' | 'pick';

/** Edit everything about a task: title, date, time, tag, priority. Delete needs a second tap. */
function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, today, act, flash } = useApp();
  const s = state.settings;
  const tomorrow = addDays(today, 1);
  const initialWhen: When = !task.dueDate ? 'none' : task.dueDate === today ? 'today' : task.dueDate === tomorrow ? 'tomorrow' : 'pick';
  const [title, setTitle] = useState(task.title);
  const [when, setWhen] = useState<When>(initialWhen);
  const [date, setDate] = useState(task.dueDate ?? today);
  const [time, setTime] = useState(task.dueTime ?? '');
  const [tag, setTag] = useState<string | null>(task.tag);
  const [prio, setPrio] = useState(task.prio);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const dueDate = when === 'none' ? null : when === 'today' ? today : when === 'tomorrow' ? tomorrow : date || null;
  const dueTime = dueDate && time ? time : null;
  const tagChoices = [...s.taskTags.map((t) => t[0]), ...(task.tag && !s.taskTags.some((t) => t[0] === task.tag) ? [task.tag] : [])];

  const run = async (method: 'PATCH' | 'DELETE', body?: unknown, msg?: string) => {
    if (busy) return;
    setBusy(true);
    const r = await act(method, `/api/tasks/${task.id}`, body);
    setBusy(false);
    if (r) {
      if (msg && !r.toast) flash(msg);
      onClose();
    }
  };

  const save = () => {
    const patch: Record<string, unknown> = {};
    if (title.trim() && title.trim() !== task.title) patch.title = title.trim();
    if (dueDate !== task.dueDate) patch.dueDate = dueDate;
    if (dueTime !== task.dueTime) patch.dueTime = dueTime;
    if (tag !== task.tag) patch.tag = tag;
    if (prio !== task.prio) patch.prio = prio;
    if (!Object.keys(patch).length) return onClose();
    void run('PATCH', patch, 'Task updated');
  };

  const label: CSSProperties = { fontSize: 12, color: C.muted };
  const field: CSSProperties = { padding: 12, borderRadius: 12, background: C.bg, border: '1px solid #3A404D', color: '#fff', fontSize: 15, outline: 'none', colorScheme: 'dark', minWidth: 0 };
  const btn: CSSProperties = { padding: '13px 14px', borderRadius: 12, border: '1px solid #2D3240', background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600, minHeight: 48 };
  return (
    <Modal label="Edit task" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label htmlFor="tm-title" style={{ fontFamily: HEAD, fontSize: 18, fontWeight: 700 }}>Edit task</label>
        <input id="tm-title" value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="off" style={{ ...field, padding: 14, fontSize: 16 }} />

        <div role="group" aria-label="When" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={label}>When</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([['none', 'No date'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['pick', 'Pick date']] as const).map(([k, l]) => (
              <Pill key={k} on={when === k} onClick={() => setWhen(k)}>{l}</Pill>
            ))}
          </div>
          {when !== 'none' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {when === 'pick' && <input aria-label="Due date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...field, flex: '1 1 150px' }} />}
              <input aria-label="Due time (optional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...field, flex: '0 1 130px' }} />
              {time && <button type="button" onClick={() => setTime('')} style={{ ...btn, minHeight: 44, padding: '10px 12px', color: C.muted }}>No time</button>}
            </div>
          )}
        </div>

        <div role="group" aria-label="Tag" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={label}>Tag</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Pill on={tag === null} onClick={() => setTag(null)}>Untagged</Pill>
            {tagChoices.map((t) => <Pill key={t} on={tag === t} onClick={() => setTag(t)} color={allTagColor(s, t)}>{t}</Pill>)}
          </div>
        </div>

        <div role="group" aria-label="Priority" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={label}>Priority</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['high', 'med', 'low'] as const).map((p) => (
              <Pill key={p} on={prio === p} onClick={() => setPrio(p)}>{p === 'high' ? 'High' : p === 'med' ? 'Medium' : 'Low'}</Pill>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ ...btn, flex: 1 }}>Cancel</button>
          <button type="submit" disabled={busy} style={{ ...btn, flex: 2, background: C.accent, color: 'var(--bg)', border: 'none', fontWeight: 700, opacity: busy ? 0.7 : 1 }}>Save changes</button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} style={{ ...btn, flex: 1 }} onClick={() => run('PATCH', { pushDays: 1 }, 'Pushed to tomorrow')}>Push to tomorrow</button>
          <button
            type="button" disabled={busy}
            style={{ ...btn, flex: 1, borderColor: armed ? '#FF7A6B' : '#5C2A24', background: armed ? '#FF7A6B' : 'transparent', color: armed ? '#1E1412' : '#FF9E92' }}
            onClick={() => (armed ? run('DELETE', undefined, 'Task deleted') : setArmed(true))}
          >
            {armed ? 'Tap again to delete' : 'Delete task'}
          </button>
        </div>
        <span aria-live="polite" style={{ fontSize: 12, color: C.dim, minHeight: 16 }}>
          {armed ? `Deleting also takes back the ${task.done ? task.xp + 5 : 5} XP this task earned.` : ''}
        </span>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- palette */

export function Palette() {
  const { palette, setPalette, state, today, phone, allTasks, allNotes } = useApp();
  const router = useNav();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, palette);
  useEffect(() => {
    // reset when closing, so nothing typed straight after opening is wiped
    if (!palette) { setQ(''); setSel(0); }
  }, [palette]);
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const out: { key: string; type: string; label: string; sub: string; color: string; go: () => void }[] = [];
    allTasks.filter((t) => t.title.toLowerCase().includes(needle)).slice(0, 6).forEach((t) =>
      out.push({ key: 't' + t.id, type: 'Task', label: t.title, sub: t.done ? 'Done' : t.dueDate ?? 'No date', color: C.blue, go: () => router.push(`/tasks?task=${t.id}`) }));
    allNotes.filter((n) => (n.title + ' ' + n.body).toLowerCase().includes(needle)).slice(0, 6).forEach((n) =>
      out.push({ key: 'n' + n.id, type: 'Note', label: n.title, sub: n.body.slice(0, 60), color: C.amber, go: () => router.push('/notes?note=' + n.id) }));
    state.events.filter((e) => e.title.toLowerCase().includes(needle) && (e.date >= today || e.repeatDays?.length)).slice(0, 4).forEach((e) => {
      // repeating habits: jump to the next day they happen
      let day = e.date;
      if (e.repeatDays?.length && day < today) {
        day = today;
        for (let i = 0; i < 7 && !e.repeatDays.includes(dow(day)); i++) day = addDays(day, 1);
      }
      out.push({ key: 'e' + e.id, type: 'Event', label: e.title, sub: day, color: C.purple, go: () => router.push(`/calendar?date=${day}`) });
    });
    return out;
  }, [q, state, today, router, allTasks, allNotes]);
  const close = () => setPalette(false);
  const pick = (i: number) => { close(); results[i]?.go(); };
  return (
    <Presence show={palette} ms={150}>
    <div
      data-anim="backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(5,6,8,.7)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: phone ? '12px 12px' : '12vh 16px' }}
    >
      <div ref={box} role="dialog" aria-modal="true" aria-label="Search everything" data-anim="dialog" style={{ width: 'min(560px, 100%)', borderRadius: 18, background: '#1C2029', border: '1px solid #3A404D', boxShadow: '0 16px 40px rgba(0,0,0,.45)', overflow: 'hidden' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderBottom: '1px solid #2D3240' }}>
          <Svg d={ICON.search} size={16} color={C.dim} sw={2.2} />
          <span style={{ position: 'absolute', left: -9999 }}>Search everything</span>
          <input
            ref={ref} autoFocus value={q} placeholder="Search tasks, notes, events"
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
    </Presence>
  );
}

/* ---------------------------------------------------------------- level up */

export function LevelUpScreen() {
  const { levelUp } = useApp();
  return <Presence show={!!levelUp} ms={200}>{levelUp && <LevelUpInner levelUp={levelUp} />}</Presence>;
}

function LevelUpInner({ levelUp }: { levelUp: LevelUp }) {
  const { dismissLevelUp, state, today, phone } = useApp();
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, !!levelUp);
  useEffect(() => {
    if (!levelUp) return;
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && dismissLevelUp();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [levelUp, dismissLevelUp]);
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
    <div ref={box} role="dialog" aria-modal="true" aria-label="You levelled up" data-anim="backdrop" style={{ position: 'fixed', inset: 0, zIndex: 100, background: phone ? C.bg : 'rgba(5,6,8,.8)', display: 'flex', justifyContent: 'center', alignItems: phone ? 'stretch' : 'center', overflowY: 'auto' }}>
      <div data-anim="dialog" style={{ width: phone ? '100%' : 420, minHeight: phone ? '100dvh' : undefined, background: C.bg, borderRadius: phone ? 0 : 28, border: phone ? 'none' : '1px solid #2D3240', padding: '28px 20px max(28px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', overflow: 'hidden' }}>
        {state.settings.flags.confetti && (
          <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 70, height: 300, pointerEvents: 'none' }}>
            {bits.map(([pos, w, h, bg, r, rot], i) => {
              const st: Record<string, string> = Object.fromEntries(pos.split(';').map((x) => x.split(':')));
              return (
                <span key={i} style={{ position: 'absolute', ...st, transform: `rotate(${rot}deg)` }}>
                  <span style={{ display: 'block', width: w, height: h, borderRadius: r, background: bg, animation: `confetti 1.6s ${0.15 + i * 0.12}s var(--ease-out) both` }} />
                </span>
              );
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
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
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
            <span>Level {levelUp.to}</span><span><Count value={p.xp} /> / {p.nextXp.toLocaleString()} XP</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: '#262B36', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: Math.min(100, Math.round(((p.xp - p.levelXp) / Math.max(1, p.nextXp - p.levelXp)) * 100)) + '%', background: C.accent, transformOrigin: 'left', animation: 'barGrow .9s .3s var(--ease-out) both' }} />
          </div>
        </div>
        <button autoFocus type="button" onClick={dismissLevelUp} style={{ marginTop: 'auto', padding: 16, borderRadius: 16, background: C.accent, color: 'var(--bg)', border: 'none', textAlign: 'center', fontWeight: 700, fontSize: 16 }}>
          Keep going
        </button>
      </div>
    </div>
  );
}
