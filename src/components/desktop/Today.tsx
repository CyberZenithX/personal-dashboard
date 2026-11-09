'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DesktopNav, LevelCard } from '../Nav';
import { useApp } from '../store';
import { C, HEAD, ICON, Svg } from '../ui';
import { DOW_LONG, MONTH_LONG, dow, fmtMin, fmtTime, minutesOfDay, parts, timeOfDayFromIso, hhmmToMin } from '@/lib/time';
import { allTagColor, eventsOn, kindLabel } from '@/lib/view';

export function greeting(min: number): string {
  return min < 12 * 60 ? 'Good morning' : min < 18 * 60 ? 'Good afternoon' : 'Good evening';
}

export function scoreMessage(score: number, checkins: number): string {
  if (!checkins && !score) return 'A clean slate. Log one thing.';
  if (score >= 90) return 'Perfect day unlocked.';
  if (score >= 75) return 'Strong day — almost there.';
  return 'Solid day. Keep it rolling.';
}

export interface TimelineEntry { min: number; color: string; title: string; sub: string; future?: boolean }

export function useTimeline(): TimelineEntry[] {
  const { state, today, tz } = useApp();
  return useMemo(() => {
    const mode = state.settings.time;
    const out: TimelineEntry[] = [];
    const minOf = (iso: string) => hhmmToMin(timeOfDayFromIso(iso, tz)) ?? 0;
    const isToday = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso)) === today;
    state.notes.filter((n) => isToday(n.createdAt)).forEach((n) =>
      out.push({ min: minOf(n.createdAt), color: C.amber, title: `Note · ${n.title}`, sub: n.body.split('\n')[0].slice(0, 70) || kindLabel(n.tag) }));
    eventsOn(state.events, today).forEach((e) =>
      out.push({ min: e.startMin, color: C.purple, title: e.title, sub: `${e.kind === 'habit' ? 'Habit' : e.kind === 'task' ? 'Time block' : 'Event'} · ${e.endMin - e.startMin} min · ${fmtMin(e.startMin, mode)}` }));
    state.voiceLogs.filter((v) => isToday(v.createdAt)).forEach((v) =>
      out.push({ min: minOf(v.createdAt), color: C.accent, title: `Voice log · ${v.itemCount} item${v.itemCount === 1 ? '' : 's'} saved`, sub: `"${v.transcript.slice(0, 60)}${v.transcript.length > 60 ? '…' : ''}"` }));
    state.tasks.filter((t) => t.done && t.doneAt && isToday(t.doneAt)).forEach((t) =>
      out.push({ min: minOf(t.doneAt as string), color: C.blue, title: `Done · ${t.title}`, sub: `+${t.xp} XP` }));
    return out.sort((a, b) => a.min - b.min);
  }, [state, today, tz]);
}

export default function Today() {
  const { state, today, tz, toggleTask, openCapture, openVoice } = useApp();
  const [tag, setTag] = useState('All');
  const s = state.settings;
  const p = state.progress;
  const day = p.days[today];
  const nowMin = minutesOfDay(new Date(), tz);
  const { y, m, d } = parts(today);
  void y;
  const timeline = useTimeline();
  const keys = s.keys;

  const tasks = state.tasks
    .filter((t) => t.dueDate === today || (t.dueDate && t.dueDate < today && !t.done))
    .filter((t) => tag === 'All' || t.tag === tag);
  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99'));

  const meta = (t: (typeof tasks)[number]) => {
    const bits: (string | null)[] = [t.tag ?? 'untagged'];
    if (t.done && t.doneAt) bits.push(`done ${fmtTime(timeOfDayFromIso(t.doneAt, tz), s.time)}`);
    else {
      if (t.dueDate && t.dueDate < today) bits.push('overdue');
      if (t.dueTime) bits.push(`due ${fmtTime(t.dueTime, s.time)}`);
      if (t.prio === 'high') bits.push('high');
    }
    return bits.filter(Boolean).join(' · ');
  };

  const recent = state.notes.slice(0, 2);
  const need = Math.max(0, s.goal - day.checkins);
  const ring = 339.3;

  const capBtn = (label: string, hint: string, color: string, bg: string, icon: string, onClick: () => void) => (
    <button
      type="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, color: C.text, textAlign: 'left', minHeight: 76 }}
    >
      <span style={{ width: 40, height: 40, borderRadius: 12, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <Svg d={icon} size={20} sw={2.2} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
        <span style={{ fontSize: 12, color: C.dim }}>Press {hint}</span>
      </span>
    </button>
  );

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, fontFamily: "'Inter Variable', Inter, system-ui, sans-serif", display: 'flex', flexWrap: 'wrap', position: 'relative' }}>
      <DesktopNav active="Today" showCount>
        <LevelCard long />
      </DesktopNav>

      <main style={{ flex: '999 1 560px', minWidth: 0, padding: '32px 40px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, color: C.muted, letterSpacing: '.04em', textTransform: 'uppercase' }}>
              {DOW_LONG[dow(today)]} · {d} {MONTH_LONG[m - 1]}
            </span>
            <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 34, fontWeight: 700 }}>{greeting(nowMin)}, {state.userName}</h1>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 99, background: '#2A1D12', border: '1px solid #4A2E16', color: C.accent2, fontWeight: 600, fontSize: 14 }}>
              <Svg d={ICON.flame} size={16} />
              {p.streak}-day streak
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 99, background: C.accentDim, border: `1px solid ${C.accentLine}`, color: C.accent, fontWeight: 600, fontSize: 14 }}>
              <Svg d={ICON.bolt} size={16} />
              +{p.xpToday} XP today
            </div>
          </div>
        </header>

        <section aria-label="Quick capture" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
          {capBtn('Task', keys[0], C.blue, '#1F2A3D', ICON.tasks, () => openCapture({ type: 'task' }))}
          {capBtn('Note', keys[1], C.amber, '#2E2614', ICON.pencil, () => openCapture({ type: 'note' }))}
          {capBtn('Event', keys[2], C.purple, '#2A1C33', ICON.calendar, () => openCapture({ type: 'event' }))}
          <button type="button" onClick={openVoice} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, border: 'none', background: C.accent, color: 'var(--bg)', textAlign: 'left', minHeight: 76 }}>
            <span style={{ width: 40, height: 40, borderRadius: 99, background: 'var(--bg)', color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Svg d={ICON.mic} size={20} sw={2.2} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Just say it</span>
              <span style={{ fontSize: 12, color: 'color-mix(in srgb, var(--bg) 75%, var(--accent))' }}>Press {keys[3]}</span>
            </span>
          </button>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section aria-label="Daily score" style={{ padding: 22, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 132, height: 132, flex: 'none' }}>
                <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`Daily score ${day.score} of 100`}>
                  <circle cx="66" cy="66" r="54" fill="none" stroke="#262B36" strokeWidth="12" />
                  <circle cx="66" cy="66" r="54" fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${((ring * day.score) / 100).toFixed(1)} ${ring}`} transform="rotate(-90 66 66)" style={{ transition: 'stroke-dasharray .6s' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: HEAD, fontSize: 36, fontWeight: 700 }}>{day.score}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>day score</span>
                </div>
              </div>
              <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 18 }}>{scoreMessage(day.score, day.checkins)}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#C3C9D4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Check-ins</span><span style={{ color: '#fff', fontWeight: 600 }}>{day.checkins} / {s.goal}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tasks done</span><span style={{ color: '#fff', fontWeight: 600 }}>{day.tasksDone} / {day.tasksTotal}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Notes logged</span><span style={{ color: '#fff', fontWeight: 600 }}>{day.notes}</span></div>
                </div>
                <span style={{ fontSize: 12, color: need ? C.accent2 : C.accent }}>
                  {need ? `${need} more check-in${need === 1 ? '' : 's'} ${need === 1 ? 'keeps' : 'keep'} your streak alive` : 'Streak is safe for today'}
                </span>
              </div>
            </section>

            <section aria-label="Tasks" style={{ padding: 22, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 18 }}>Today’s tasks</h2>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['All', ...s.taskTags.map((t) => t[0])].map((g) => {
                    const on = tag === g;
                    return (
                      <button key={g} type="button" aria-pressed={on} onClick={() => setTag(g)} style={{ padding: '6px 12px', borderRadius: 99, border: `1px solid ${on ? C.accent : C.border2}`, background: on ? C.accentDim : 'transparent', color: on ? C.accent : C.muted, fontSize: 12, fontWeight: on ? 600 : 400 }}>
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!sorted.length && <span style={{ fontSize: 13, color: C.dim, padding: '8px 4px' }}>Nothing due today. Press {keys[0]} to add a task.</span>}
                {sorted.map((t) => (
                  <button
                    key={t.id} type="button" onClick={() => toggleTask(t.id)} aria-pressed={t.done}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 12, background: t.done ? C.accentRow : C.surface2, border: '1px solid transparent', color: C.text, textAlign: 'left', minHeight: 52, transition: 'background .25s' }}
                  >
                    <span style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${t.done ? C.accent : '#4A5160'}`, background: t.done ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', transition: 'all .2s' }}>
                      {t.done && <Svg d={ICON.check} size={14} sw={3.5} color="var(--bg)" />}
                    </span>
                    <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? C.dim : C.text }}>{t.title}</span>
                      <span style={{ fontSize: 12, color: C.dim }}>{meta(t)}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: t.done ? C.accent : C.dim }}>+{t.xp} XP</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section aria-label="Today timeline" style={{ padding: 22, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 18 }}>Your day so far</h2>
                {s.pages.Calendar && <Link href="/calendar" style={{ fontSize: 13, textDecoration: 'none', padding: '6px 4px', margin: '-6px -4px' }}>Open calendar</Link>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {(() => {
                  const past = timeline.filter((e) => e.min <= nowMin);
                  const later = timeline.filter((e) => e.min > nowMin);
                  const row = (e: TimelineEntry, i: number, dim: boolean) => (
                    <div key={`${dim ? 'l' : 'p'}${i}`} style={{ display: 'flex', gap: 14, opacity: dim ? 0.7 : 1 }}>
                      <span style={{ width: 48, flex: 'none', fontSize: 12, color: C.dim, paddingTop: 2 }}>{fmtMin(e.min, s.time)}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 99, background: e.color, marginTop: 4 }} />
                        <span style={{ flex: 1, width: 2, background: '#262B36' }} />
                      </div>
                      <div style={{ paddingBottom: 18, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{e.title}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>{e.sub}</span>
                      </div>
                    </div>
                  );
                  return (
                    <>
                      {past.map((e, i) => row(e, i, false))}
                      <button type="button" onClick={() => openCapture({ type: 'note' })} style={{ display: 'flex', gap: 14, padding: 0, border: 'none', background: 'transparent', color: C.text, textAlign: 'left', paddingBottom: later.length ? 18 : 0 }}>
                        <span style={{ width: 48, flex: 'none', fontSize: 12, color: C.accent, paddingTop: 2, fontWeight: 600 }}>Now</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ width: 10, height: 10, borderRadius: 99, border: `2px dashed ${C.accent}`, marginTop: 3 }} />
                          {later.length > 0 && <span style={{ flex: 1, width: 2, background: '#262B36' }} />}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: C.accent }}>What’s happening right now?</span>
                          <span style={{ fontSize: 12, color: C.muted }}>Log it → +5 XP · check-in {Math.min(day.checkins + 1, Math.max(s.goal, day.checkins + 1))} of {s.goal}</span>
                        </div>
                      </button>
                      {later.map((e, i) => row(e, i, true))}
                    </>
                  );
                })()}
              </div>
            </section>

            <section aria-label="Recent notes" style={{ padding: 22, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 18 }}>Recent notes</h2>
              {!recent.length && <span style={{ fontSize: 13, color: C.dim }}>No notes yet. Press {keys[1]} to write one.</span>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {recent.map((n) => (
                  <Link key={n.id} href={`/notes?note=${n.id}`} style={{ padding: 14, borderRadius: 12, background: C.surface2, display: 'flex', flexDirection: 'column', gap: 6, textDecoration: 'none', color: C.text }}>
                    <span style={{ fontSize: 11, color: allTagColor(s, n.tag), fontWeight: 600, letterSpacing: '.04em' }}>{kindLabel(n.tag)}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.45 }}>{(n.body || n.title).slice(0, 110)}</span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
