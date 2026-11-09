'use client';
import Link from 'next/link';
import { useApp } from '../store';
import { C, HEAD, ICON, Svg } from '../ui';
import { scoreMessage } from '../desktop/Today';
import { DOW_SHORT, dow, fmtMin, fmtTime, hhmmToMin, minutesOfDay, MONTH_SHORT, parts } from '@/lib/time';
import { eventsOn } from '@/lib/view';
import { levelPct } from '@/lib/levels';

export default function PhoneToday() {
  const { state, today, tz, toggleTask, openCapture, openVoice } = useApp();
  const s = state.settings;
  const p = state.progress;
  const day = p.days[today];
  const nowMin = minutesOfDay(new Date(), tz);
  const { m, d } = parts(today);
  const ring = 213.6;

  const tasks = state.tasks
    .filter((t) => t.dueDate === today || (t.dueDate && t.dueDate < today && !t.done))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99'));
  const doneCount = tasks.filter((t) => t.done).length;

  const upcoming = [
    ...eventsOn(state.events, today).map((e) => ({ title: e.title, min: e.startMin })),
    ...state.tasks.filter((t) => t.dueDate === today && t.dueTime && !t.done).map((t) => ({ title: t.title, min: hhmmToMin(t.dueTime) ?? 0 }))
  ].filter((u) => u.min >= nowMin - 5).sort((a, b) => a.min - b.min)[0];

  const actBtn = (label: string, color: string, icon: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0', border: 'none', background: 'transparent', color, fontSize: 11, fontWeight: 600, minHeight: 52 }}>
      <Svg d={icon} size={22} sw={2.2} />{label}
    </button>
  );

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100dvh', position: 'relative' }}>
      <div style={{ padding: '24px 20px 130px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>{DOW_SHORT[dow(today)]} · {d} {MONTH_SHORT[m - 1]}</span>
            <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 24, fontWeight: 700 }}>Today</h1>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 99, background: '#2A1D12', color: C.accent2, fontSize: 13, fontWeight: 700 }}>
              <Svg d={ICON.flame} size={14} sw={2.2} />{p.streak}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: 99, background: C.accentDim, color: C.accent, fontSize: 13, fontWeight: 700 }}>Lv {p.level}</span>
            <Link href="/settings" aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 99, background: C.surface, color: '#C3C9D4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Svg d={ICON.settings} size={18} sw={2.2} />
            </Link>
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 84, height: 84, flex: 'none' }}>
            <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`Day score ${day.score}`}>
              <circle cx="42" cy="42" r="34" fill="none" stroke="#262B36" strokeWidth="9" />
              <circle cx="42" cy="42" r="34" fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${((ring * day.score) / 100).toFixed(1)} ${ring}`} transform="rotate(-90 42 42)" style={{ transition: 'stroke-dasharray .6s' }} />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HEAD, fontSize: 24, fontWeight: 700 }}>{day.score}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Day score</span>
            <span style={{ fontSize: 12, color: C.muted }}>{scoreMessage(day.score, day.checkins)}</span>
            <div style={{ height: 6, borderRadius: 99, background: '#262B36', overflow: 'hidden' }}><div style={{ height: '100%', width: levelPct(p) + '%', background: C.accent, transition: 'width .5s' }} /></div>
            <span style={{ fontSize: 12, color: C.muted }}>{p.xp.toLocaleString()} / {p.nextXp.toLocaleString()} XP to Lv {Math.min(30, p.level + 1)}</span>
            <span style={{ fontSize: 12, color: day.checkins >= s.goal ? C.accent : C.accent2 }}>Check-in {Math.min(day.checkins, s.goal)} of {s.goal} today</span>
          </div>
        </div>

        {upcoming && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#C3C9D4' }}>Up next</span>
              {s.pages.Calendar && <Link href="/calendar" style={{ fontSize: 12, textDecoration: 'none', padding: '8px 4px', margin: '-8px -4px' }}>Calendar</Link>}
            </div>
            <div style={{ padding: 14, borderRadius: 14, background: '#2A1C33', color: '#E7C8FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{upcoming.title}</span><span style={{ fontSize: 12 }}>{fmtMin(upcoming.min, s.time)}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#C3C9D4' }}>Tasks · {doneCount}/{tasks.length}</span>
          {!tasks.length && <span style={{ fontSize: 13, color: C.dim, padding: '6px 4px' }}>Nothing due today. Tap Task below to add one.</span>}
          {tasks.map((t) => (
            <button key={t.id} type="button" onClick={() => toggleTask(t.id)} aria-pressed={t.done} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: t.done ? C.accentRow : C.surface, border: 'none', color: C.text, textAlign: 'left', minHeight: 52, transition: 'background .25s' }}>
              <span style={{ width: 24, height: 24, borderRadius: 99, border: `2px solid ${t.done ? C.accent : '#4A5160'}`, background: t.done ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', transition: 'all .2s' }}>
                {t.done && <Svg d={ICON.check} size={13} sw={3.5} color="var(--bg)" />}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? C.dim : C.text }}>{t.title}</span>
                {t.dueTime && !t.done && <span style={{ fontSize: 12, color: C.dim }}>{fmtTime(t.dueTime, s.time)}</span>}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.done ? C.accent : C.dim }}>+{t.xp}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {([['All tasks', '/tasks', 'Tasks'], ['Notes', '/notes', 'Notes'], ['Calendar', '/calendar', 'Calendar']] as const)
            .filter(([, , k]) => s.pages[k])
            .map(([l, href]) => (
              <Link key={l} href={href} style={{ padding: '12px 8px', borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, color: '#C3C9D4', textAlign: 'center', textDecoration: 'none', fontSize: 13, fontWeight: 600, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{l}</Link>
            ))}
        </div>
      </div>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px 16px max(22px, env(safe-area-inset-bottom))', background: C.side, borderTop: '1px solid #1F232C', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, zIndex: 20 }}>
        {actBtn('Task', C.blue, ICON.tasks, () => openCapture({ type: 'task' }))}
        {actBtn('Note', C.amber, ICON.pencil, () => openCapture({ type: 'note' }))}
        <button type="button" onClick={openVoice} aria-label="Talk: log something by voice" style={{ width: 64, height: 64, marginTop: -30, borderRadius: 99, border: 'none', background: C.accent, color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: `0 8px 28px ${C.glow2}` }}>
          <Svg d={ICON.mic} size={28} sw={2.2} />
        </button>
        {actBtn('Event', C.purple, ICON.calendar, () => openCapture({ type: 'event' }))}
        <Link href="/progress" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0', color: C.muted, fontSize: 11, fontWeight: 600, textDecoration: 'none', minHeight: 52 }}>
          <Svg d={ICON.progress} size={22} sw={2.2} />Stats
        </Link>
      </div>
    </div>
  );
}
