'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatedList } from '../motion';
import { useApp } from '../store';
import { C, HEAD, ICON, Svg } from '../ui';
import { PRIO_COLOR, groupTasks, type TaskView } from '../desktop/Tasks';
import type { Task } from '@/lib/types';
import { allTagColor, dueLabel, taskGroup } from '@/lib/view';

const GROUP_COLOR: Record<string, string> = { Overdue: '#FF9E7A', Today: 'var(--accent)' };

/** Swipe right = finish, left = push to tomorrow, long-press = actions. */
export function SwipeRow({ task, children, highlight }: { task: Task; children: ReactNode; highlight?: boolean }) {
  const { toggleTask, act, openTaskMenu, flash } = useApp();
  const start = useRef<{ x: number; y: number } | null>(null);
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const long = useRef(false);
  /** set after a long-press or swipe so the tap that follows doesn't also tick the task */
  const suppress = useRef(false);
  const [dx, setDx] = useState(0);
  const horizontal = useRef(false);

  const reset = () => { start.current = null; horizontal.current = false; setDx(0); clearTimeout(press.current); };
  return (
    <div data-task-id={task.id} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', boxShadow: highlight ? `0 0 0 2px ${C.accent}` : undefined, transition: 'box-shadow .4s' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: dx > 0 ? 'flex-start' : 'flex-end', alignItems: 'center', padding: '0 20px', background: dx > 0 ? C.accent : '#3A404D', color: dx > 0 ? 'var(--bg)' : '#fff', fontSize: 12, fontWeight: 700 }}>
        {dx > 0 ? 'Finish' : dx < 0 ? 'Tomorrow' : ''}
      </div>
      <div
        onTouchStart={(e) => {
          const t = e.touches[0];
          start.current = { x: t.clientX, y: t.clientY };
          long.current = false;
          press.current = setTimeout(() => { long.current = true; suppress.current = true; navigator.vibrate?.(10); openTaskMenu(task.id); }, 550);
        }}
        onTouchMove={(e) => {
          if (!start.current) return;
          const t = e.touches[0];
          const mx = t.clientX - start.current.x, my = t.clientY - start.current.y;
          if (!horizontal.current && Math.abs(my) > 10) return reset();
          if (Math.abs(mx) > 10) { horizontal.current = true; clearTimeout(press.current); }
          if (horizontal.current) setDx(Math.max(-120, Math.min(120, mx)));
        }}
        onTouchEnd={() => {
          const moved = dx;
          const wasLong = long.current;
          reset();
          if (wasLong) return;
          if (Math.abs(moved) > 10) suppress.current = true;
          if (moved > 80) {
            toggleTask(task.id);
          } else if (moved < -80) {
            void act('PATCH', `/api/tasks/${task.id}`, { pushDays: 1 }).then((r) => r && flash(`Pushed to tomorrow · ${task.title}`));
          }
        }}
        onClickCapture={(e) => {
          if (suppress.current) {
            suppress.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onTouchCancel={reset}
        onContextMenu={(e) => e.preventDefault()}
        style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? 'transform .2s' : 'none', touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </div>
  );
}

export default function PhoneTasks() {
  const { state, today, tz, toggleTask, openCapture, openTaskMenu, allTasks, moreTasks, loadOlder } = useApp();
  const s = state.settings;
  const q = state.progress.overdueQuest;
  const [view, setView] = useState<'Today' | 'Upcoming' | 'Done'>('Today');
  const [tag, setTag] = useState('All');
  const [flashId, setFlashId] = useState<number | null>(null);
  const params = useSearchParams();
  // ?task=ID (from search): open the right tab and scroll to it
  useEffect(() => {
    const id = Number(params.get('task'));
    const t = id ? allTasks.find((x) => x.id === id) : undefined;
    if (!t) return;
    const g = taskGroup(t, today);
    setTag('All');
    setView(t.done ? 'Done' : g === 'Overdue' || g === 'Today' || g === 'Tomorrow' ? 'Today' : 'Upcoming');
    setFlashId(id);
    setTimeout(() => document.querySelector(`[data-task-id="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
    const off = setTimeout(() => setFlashId(null), 2500);
    return () => clearTimeout(off);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const visible = allTasks.filter((t) => tag === 'All' || t.tag === tag);
  const groups = view === 'Upcoming'
    ? [...groupTasks(visible, 'Upcoming', today, tz), ...groupTasks(visible, 'Someday', today, tz)]
    : groupTasks(visible, view as TaskView, today, tz);

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100dvh' }}>
      <div style={{ padding: '24px 20px 130px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 26 }}>Tasks</h1>
          <span style={{ fontSize: 13, color: C.muted }}>{state.tasks.filter((t) => !t.done).length} open</span>
        </div>
        <div role="tablist" aria-label="View" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, padding: 4, borderRadius: 12, background: C.surface }}>
          {(['Today', 'Upcoming', 'Done'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} style={{ padding: '10px 0', borderRadius: 9, border: 'none', background: view === v ? C.accent : 'transparent', color: view === v ? 'var(--bg)' : C.muted, fontSize: 13, fontWeight: 600, minHeight: 40 }}>{v}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
          {['All', ...s.taskTags.map((t) => t[0])].map((g) => (
            <button key={g} type="button" aria-pressed={tag === g} onClick={() => setTag(g)} style={{ flex: 'none', padding: '8px 14px', borderRadius: 99, border: `1px solid ${tag === g ? '#5A6273' : C.border2}`, background: tag === g ? '#1C2029' : 'transparent', color: tag === g ? '#fff' : C.muted, fontSize: 13, fontWeight: 600, minHeight: 40 }}>{g}</button>
          ))}
        </div>

        <div style={{ padding: 14, borderRadius: 14, background: C.accentRow, border: `1px solid ${C.accentLine}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, flex: 'none' }}>QUEST</span>
          <span style={{ flex: 1, fontSize: 13 }}>Clear overdue · {q.done}/{q.total}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>+40</span>
        </div>

        {groups.every((g) => !g.items.length) && <span style={{ fontSize: 13, color: C.dim, textAlign: 'center', padding: 16 }}>{view === 'Done' ? 'Nothing finished yet.' : 'All clear here.'}</span>}

        {groups.filter((g) => g.items.length).map((grp) => (
          <section key={grp.label} aria-label={grp.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 style={{ margin: 0, padding: '4px 4px 2px', fontSize: 12, fontWeight: 700, color: GROUP_COLOR[grp.label] ?? C.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>{grp.label} · {grp.items.length}</h2>
            <AnimatedList>
            {grp.items.map((t) => (
              <SwipeRow key={t.id} task={t} highlight={flashId === t.id}>
                <div style={{ display: 'flex', alignItems: 'center', borderRadius: 12, background: t.done ? C.accentRow2 : C.surface, transition: 'background .25s' }}>
                <button type="button" data-row onClick={() => toggleTask(t.id)} aria-pressed={t.done} aria-label={`${t.done ? 'Mark not done' : 'Complete'}: ${t.title}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: 'transparent', border: 'none', color: C.text, textAlign: 'left', minHeight: 56 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 99, border: `2px solid ${t.done ? C.accent : '#4A5160'}`, background: t.done ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    {t.done && <Svg className="tick" d={ICON.check} size={13} sw={3.5} color="var(--bg)" />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 14, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? C.dim : C.text }}>{t.title}</span>
                    <span style={{ fontSize: 12, color: grp.label === 'Overdue' && !t.done ? '#FF9E7A' : C.dim }}>
                      {dueLabel(t, today, tz, s.time)} · <span style={{ color: allTagColor(s, t.tag) }}>{t.tag ?? 'untagged'}</span>
                    </span>
                  </span>
                  <span title={`${t.prio} priority`} style={{ width: 8, height: 8, borderRadius: 3, background: PRIO_COLOR[t.prio], flex: 'none' }} />
                </button>
                <button type="button" aria-label={`Edit, reschedule or delete: ${t.title}`} onClick={() => openTaskMenu(t.id)} style={{ width: 44, height: 44, marginRight: 6, flex: 'none', borderRadius: 10, border: 'none', background: 'transparent', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg d={ICON.dots} size={18} sw={3} />
                </button>
                </div>
              </SwipeRow>
            ))}
            </AnimatedList>
          </section>
        ))}
        {view === 'Done' && moreTasks && (
            <button type="button" onClick={() => void loadOlder('tasks')} style={{ padding: 12, minHeight: 44, borderRadius: 12, border: `1px dashed ${C.border2}`, background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600 }}>
              Load older finished tasks
            </button>
          )}
        <span style={{ fontSize: 12, color: C.dim, paddingRight: 76, lineHeight: 1.5 }}>Swipe a task right to finish, left to push to tomorrow. Tap ⋯ to edit, change its tag or date, or delete it.</span>
      </div>

      <button type="button" aria-label="Add task" onClick={() => openCapture({ type: 'task' })} style={{ position: 'fixed', right: 20, bottom: 'calc(104px + env(safe-area-inset-bottom))', width: 56, height: 56, borderRadius: 18, border: 'none', background: C.blue, color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(127,178,255,.3)', zIndex: 15 }}>
        <Svg d={ICON.plus} size={24} sw={2.6} />
      </button>
    </div>
  );
}
