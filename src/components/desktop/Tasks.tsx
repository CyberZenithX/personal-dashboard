'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DesktopNav, LevelCard } from '../Nav';
import { useApp } from '../store';
import { C, HEAD, ICON, Svg, visuallyHidden } from '../ui';
import { parseQuick } from '@/lib/parse';
import { addDays, weekStart, ymd } from '@/lib/time';
import type { Task } from '@/lib/types';
import { allTagColor, dueLabel, taskGroup, type Group } from '@/lib/view';

export const PRIO_COLOR = { high: '#FF7A6B', med: '#FFC85C', low: '#4A5160' } as const;
const GROUP_COLOR: Record<Group, string> = {
  Overdue: '#FF9E7A', Today: 'var(--accent)', Tomorrow: '#A7AFBD', 'This week': '#A7AFBD', Later: '#A7AFBD', Someday: '#A7AFBD', Done: '#A7AFBD'
};

export type TaskView = 'Today' | 'Upcoming' | 'Someday' | 'Done';

export function groupTasks(tasks: Task[], view: TaskView, today: string, tz: string): { label: Group; items: Task[] }[] {
  const doneToday = (t: Task) => !!t.doneAt && ymd(new Date(t.doneAt), tz) === today;
  const by = (labels: Group[], pred: (t: Task) => boolean) =>
    labels.map((label) => ({ label, items: tasks.filter((t) => pred(t) && taskGroup(t, today) === label) }));
  const sortFn = (a: Task, b: Task) =>
    Number(a.done) - Number(b.done) || (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9') || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') || a.id - b.id;
  let groups: { label: Group; items: Task[] }[];
  if (view === 'Today') groups = by(['Overdue', 'Today', 'Tomorrow'], (t) => (t.done ? doneToday(t) || t.dueDate === today || t.dueDate === addDays(today, 1) : true));
  else if (view === 'Upcoming') groups = by(['Tomorrow', 'This week', 'Later'], (t) => !t.done);
  else if (view === 'Someday') groups = [{ label: 'Someday', items: tasks.filter((t) => !t.done && !t.dueDate) }];
  else groups = [{ label: 'Done', items: tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')) }];
  return groups.map((g) => ({ ...g, items: view === 'Done' ? g.items : [...g.items].sort(sortFn) }));
}

export default function Tasks() {
  const { state, today, tz, act, toggleTask, openTaskMenu, selectedTask, setSelectedTask, allTasks, moreTasks, loadOlder } = useApp();
  const s = state.settings;
  const p = state.progress;
  const [view, setView] = useState<TaskView>('Today');
  const [tag, setTag] = useState('All');
  const params = useSearchParams();
  // ?task=ID (from search): show the view that contains it, select it and scroll to it
  useEffect(() => {
    const id = Number(params.get('task'));
    const t = id ? allTasks.find((x) => x.id === id) : undefined;
    if (!t) return;
    const g = taskGroup(t, today);
    setTag('All');
    setView(t.done ? 'Done' : g === 'Someday' ? 'Someday' : g === 'Overdue' || g === 'Today' || g === 'Tomorrow' ? 'Today' : 'Upcoming');
    setSelectedTask(id);
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-task-id="${id}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const selTask = allTasks.find((t) => t.id === selectedTask);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [literal, setLiteral] = useState(false);

  const parsed = useMemo(() => (literal ? { title: draft, tag: null, date: null, time: null } : parseQuick(draft, today)), [draft, today, literal]);
  const visible = allTasks.filter((t) => tag === 'All' || t.tag === tag);
  const groups = groupTasks(visible, view, today, tz);
  const doneTodayCount = state.tasks.filter((t) => t.done && t.doneAt && ymd(new Date(t.doneAt), tz) === today).length;

  const ws = weekStart(today, s.week);
  const weekDone = state.tasks.filter((t) => t.done && t.doneAt && ymd(new Date(t.doneAt), tz) >= ws && ymd(new Date(t.doneAt), tz) <= addDays(ws, 6));
  const onTime = weekDone.length ? Math.round((weekDone.filter((t) => !t.dueDate || ymd(new Date(t.doneAt as string), tz) <= t.dueDate).length / weekDone.length) * 100) : 0;
  const tagCounts = new Map<string, number>();
  (weekDone.length ? weekDone : state.tasks).forEach((t) => t.tag && tagCounts.set(t.tag, (tagCounts.get(t.tag) ?? 0) + 1));
  const busiest = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const weekXp = weekDone.reduce((a, t) => a + t.xp, 0);
  const q = p.overdueQuest;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    const r = await act('POST', '/api/tasks', { title: draft, parse: !literal });
    setBusy(false);
    if (r) { setDraft(''); setLiteral(false); }
  };

  const keyHint = (i: number) => s.keys[i];
  const whenPill = parsed.date ? dueLabel({ dueDate: parsed.date, dueTime: parsed.time, done: false, doneAt: null } as Task, today, tz, s.time) : 'No date';
  const detected = !!(parsed.date || parsed.tag);

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, display: 'flex', flexWrap: 'wrap', position: 'relative' }}>
      <DesktopNav active="Tasks">
        <LevelCard />
      </DesktopNav>

      <main style={{ flex: '999 1 560px', minWidth: 0, padding: '32px 40px 48px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, color: C.muted, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                {state.tasks.filter((t) => !t.done).length} open · {doneTodayCount} done today
              </span>
              <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 34 }}>Tasks</h1>
            </div>
            <div role="tablist" aria-label="View" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
              {(['Today', 'Upcoming', 'Someday', 'Done'] as TaskView[]).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: view === v ? C.accent : 'transparent', color: view === v ? 'var(--bg)' : C.muted, fontSize: 13, fontWeight: 600 }}>
                  {v}
                </button>
              ))}
            </div>
          </header>

          <form onSubmit={add} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 16px', borderRadius: 16, background: C.surface, border: `1px solid ${C.border2}`, flexWrap: 'wrap' }}>
            <Svg d={ICON.plus} size={20} sw={2.4} color="var(--accent)" />
            <label htmlFor="quickadd" style={visuallyHidden}>Add a task</label>
            <input
              id="quickadd" value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off"
              placeholder="Add a task — e.g. Pay DEWA bill fri #life"
              style={{ flex: '1 1 260px', minWidth: 0, padding: '10px 0', background: 'transparent', border: 'none', color: '#fff', fontSize: 15, outline: 'none' }}
            />
            <span aria-live="polite" style={{ display: 'contents' }}>
              <span style={{ fontSize: 12, color: parsed.date ? C.accent : C.dim, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border2}`, textDecoration: literal ? 'line-through' : 'none' }}>{whenPill}</span>
              <span style={{ fontSize: 12, color: parsed.tag ? C.accent : C.dim, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border2}` }}>{parsed.tag ?? '#tag'}</span>
            </span>
            {(detected || literal) && (
              <button type="button" onClick={() => setLiteral(!literal)} title={literal ? 'Detect the date, time and tag from what you typed' : 'Save the title exactly as typed, with no date, time or tag'} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border2}`, background: 'transparent', color: C.muted, fontSize: 12, minHeight: 32 }}>
                {literal ? 'Detect' : 'Ignore'}
              </button>
            )}
            <button type="submit" disabled={busy} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: C.accent, color: 'var(--bg)', fontWeight: 700, fontSize: 13 }}>Add · Enter</button>
          </form>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['All', ...s.taskTags.map((t) => t[0])].map((g) => {
              const on = tag === g;
              const count = state.tasks.filter((t) => !t.done && (g === 'All' || t.tag === g)).length;
              return (
                <button key={g} type="button" aria-pressed={on} onClick={() => setTag(g)} style={{ padding: '7px 14px', borderRadius: 99, border: `1px solid ${on ? '#5A6273' : C.border2}`, background: on ? '#1C2029' : 'transparent', color: on ? '#fff' : C.muted, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: g === 'All' ? C.accent : allTagColor(s, g) }} />
                  {g}
                  <span style={{ fontSize: 11, opacity: 0.75 }} aria-label={`${count} open`}>{count}</span>
                </button>
              );
            })}
          </div>

          <span aria-live="polite" style={visuallyHidden}>
            {selTask ? `Selected: ${selTask.title}. ${s.keys[4]} to ${selTask.done ? 'mark not done' : 'complete'}, ${s.keys[5]} to push to tomorrow.` : ''}
          </span>
          {groups.every((g) => !g.items.length) && (
            <div style={{ padding: 28, borderRadius: 14, border: `1px dashed ${C.border2}`, color: C.dim, fontSize: 14, textAlign: 'center' }}>
              {view === 'Done' ? 'Nothing finished yet — go get one.' : 'All clear here. Add a task above or press ' + s.keys[0] + '.'}
            </div>
          )}

          {groups.filter((g) => g.items.length || view === 'Today').map((grp) => (
            <section key={grp.label} aria-label={grp.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px 4px' }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: GROUP_COLOR[grp.label], letterSpacing: '.05em', textTransform: 'uppercase' }}>{grp.label}</h2>
                <span style={{ fontSize: 12, color: C.dim }}>{grp.items.length}</span>
              </div>
              {grp.items.map((t) => {
                const sel = selectedTask === t.id;
                return (
                  <div
                    key={t.id} tabIndex={0} onFocus={() => setSelectedTask(t.id)} onClick={() => setSelectedTask(t.id)}
                    data-task-id={t.id} role="group" aria-label={t.title} aria-current={sel ? 'true' : undefined}
                    style={{ outline: sel ? `2px solid ${C.accentLine}` : undefined, outlineOffset: 1, display: 'flex', alignItems: 'center', gap: 14, padding: 'var(--row-pad) 14px', borderRadius: 12, background: t.done ? C.accentRow2 : C.surface, border: `1px solid ${sel ? '#5A6273' : '#22262F'}`, transition: 'background .25s' }}
                  >
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleTask(t.id); }} aria-pressed={t.done} aria-label={`Complete ${t.title}`} style={{ width: 44, height: 44, margin: '-11px -8px -11px -11px', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${t.done ? C.accent : '#4A5160'}`, background: t.done ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
                        {t.done && <Svg d={ICON.check} size={13} sw={3.5} color="var(--bg)" />}
                      </span>
                    </button>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? C.dim : C.text }}>{t.title}</span>
                      <span style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: C.dim, flexWrap: 'wrap' }}>
                        <span style={{ color: grp.label === 'Overdue' && !t.done ? '#FF9E7A' : C.dim }}>{dueLabel(t, today, tz, s.time)}</span>
                        {t.sub && <span>{t.sub}</span>}
                      </span>
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 99, background: C.surface2, color: allTagColor(s, t.tag), fontSize: 12, fontWeight: 600 }}>{t.tag ?? 'untagged'}</span>
                    <span title="Priority" style={{ width: 10, height: 10, borderRadius: 3, background: PRIO_COLOR[t.prio], flex: 'none' }} />
                    <span style={{ width: 52, textAlign: 'right', fontSize: 12, fontWeight: 700, color: t.done ? C.accent : C.dim }}>+{t.xp} XP</span>
                    <button type="button" className="row-actions" aria-label={`Actions for ${t.title}`} onClick={(e) => { e.stopPropagation(); openTaskMenu(t.id); }} style={{ width: 32, height: 32, margin: '-6px -6px -6px 0', borderRadius: 8, border: 'none', background: 'transparent', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <Svg d={ICON.dots} size={18} sw={3} />
                    </button>
                  </div>
                );
              })}
            </section>
          ))}
          {view === 'Done' && moreTasks && (
            <button type="button" onClick={() => void loadOlder('tasks')} style={{ padding: 12, minHeight: 44, borderRadius: 12, border: `1px dashed ${C.border2}`, background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600 }}>
              Load older finished tasks
            </button>
          )}
        </div>

        <aside style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section aria-label="Quest" style={{ padding: 20, borderRadius: 18, background: C.accentRow, border: `1px solid ${C.accentLine}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '.06em' }}>TODAY’S QUEST</span>
            <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 20 }}>Clear every overdue task</h2>
            <div style={{ height: 8, borderRadius: 99, background: '#262B36', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: (q.total ? Math.round((q.done / q.total) * 100) : 100) + '%', background: C.accent, transition: 'width .5s' }} />
            </div>
            <span style={{ fontSize: 13, color: '#C3C9D4' }}>
              {q.total ? `${q.done} of ${q.total} cleared` : 'Nothing overdue — nice'} · bonus <strong style={{ color: C.accent }}>+40 XP</strong>
            </span>
          </section>

          <section aria-label="This week" style={{ padding: 20, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 17 }}>This week</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {[
                [String(weekDone.length), 'tasks done', undefined],
                [weekDone.length ? onTime + '%' : '—', 'on time', undefined],
                [busiest, 'busiest tag', allTagColor(s, busiest)],
                ['+' + weekXp, 'XP from tasks', C.accent]
              ].map(([v, l, col]) => (
                <div key={l} style={{ padding: 14, borderRadius: 12, background: C.surface2, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: HEAD, fontSize: 26, fontWeight: 700, color: col }}>{v}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{l}</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Shortcuts" style={{ padding: 20, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#C3C9D4' }}>
            <h2 style={{ margin: '0 0 4px', fontFamily: HEAD, fontSize: 17, color: C.text }}>Fast keys</h2>
            {[['New task', s.keys[0]], ['Complete selected', s.keys[4]], ['Push to tomorrow', s.keys[5]], ['Talk instead', keyHint(3)]].map(([l, k]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l}</span><span style={{ color: '#fff', fontWeight: 600 }}>{k}</span></div>
            ))}
          </section>
        </aside>
      </main>
    </div>
  );
}
