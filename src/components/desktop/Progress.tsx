'use client';
import { useEffect, useState } from 'react';
import { DesktopNav } from '../Nav';
import { Count, Presence } from '../motion';
import { useApp } from '../store';
import { C, HEAD, ICON, Svg } from '../ui';
import { LADDER, levelPct, titleFor } from '@/lib/levels';
import { addDays, DOW_SHORT, dow, minutesOfDay, weekStart } from '@/lib/time';

export const SHADES = ['#22262F', '#3D4A1C', '#6E8A22', '#A4CC2B', '#C6F432'];
const QUEST_ICON = {
  checkin: [ICON.today, '#1F2A3D', '#7FB2FF'],
  voice: [ICON.mic, '#1C2310', '#C6F432'],
  tasks: [ICON.tasks, '#1F2A3D', '#7FB2FF'],
  evening: [ICON.pencil, '#2E2614', '#FFC85C']
} as const;
const BADGE_ICON: Record<string, [string, string]> = {
  'first-week': [ICON.flame, '#FFB36B'],
  talker: ['M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M5 11a7 7 0 0 0 14 0', '#C6F432'],
  closer: ['M9 11l3 3 8-8', '#7FB2FF'],
  'early-bird': ['M12 3v2M5 12H3M21 12h-2M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10', '#FFC85C'],
  perfect: [ICON.star, '#D59CFF'],
  month: ['M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5', '#FFB36B'],
  thinker: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6', '#FFC85C'],
  zero: ['M4 13l4 4L20 5', '#7FB2FF'],
  warrior: [ICON.bolt, '#C6F432'],
  scribe: [ICON.pencil, '#FFC85C'],
  linked: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', '#7FB2FF'],
  architect: ['M4 20h16M6 20V10l6-6 6 6v10M10 20v-5h4v5', '#D59CFF']
};

export function heatLevel(checkins: number, goal: number): number {
  return checkins <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((checkins / Math.max(1, goal)) * 4)));
}

export function resetsIn(tz: string): string {
  const left = 1440 - minutesOfDay(new Date(), tz);
  return `${Math.floor(left / 60)}h ${left % 60}m`;
}

export function paceText(p: { xp: number; nextXp: number; level: number; paceXpPerDay: number; nextTitle: string | null }): string {
  if (p.level >= 30) return 'You’ve reached the final level';
  const remaining = p.nextXp - p.xp;
  if (p.paceXpPerDay <= 0) return 'Log something today to get moving';
  const days = Math.max(1, Math.ceil(remaining / p.paceXpPerDay));
  return days <= 1 ? 'About a day away at your current pace' : `About ${days} days away at your current pace`;
}

export default function Progress() {
  const { state, today, tz } = useApp();
  const p = state.progress;
  const s = state.settings;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ws = weekStart(today, s.week);
  const start = addDays(ws, -7 * 11);
  const weeks = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  const labelRows = [0, 2, 4, 6].map((i) => DOW_SHORT[(dow(start) + i) % 7]);
  const week7 = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const maxXp = Math.max(1, ...week7.map((d) => p.days[d]?.xp ?? 0));
  const pct = p.lastWeekXp > 0 ? Math.round(((p.weekXp - p.lastWeekXp) / p.lastWeekXp) * 100) : null;
  const barPct = levelPct(p);

  const curEntry = titleFor(p.level).entry;
  const ladder = LADDER.map(([lvl, name, xp, reward], i) => {
    const done = i < curEntry, now = i === curEntry, next = i === curEntry + 1;
    return { lvl, name, xp, i, done, now, next, last: i === LADDER.length - 1, reward };
  }).slice(Math.max(0, curEntry - 3));

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, display: 'flex', flexWrap: 'wrap', position: 'relative' }}>
      <DesktopNav active="Progress" />
      <main style={{ flex: '999 1 560px', minWidth: 0, padding: '32px 40px 48px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 34 }}>Progress</h1>

        <section aria-label="Level" style={{ padding: 26, borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 110, height: 110, borderRadius: 30, background: C.accent, color: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em' }}>LEVEL</span>
            <span style={{ fontFamily: HEAD, fontSize: 52, fontWeight: 700, lineHeight: 1 }}>{p.level}</span>
          </div>
          <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: HEAD, fontSize: 24, fontWeight: 700 }}>{p.title}</span>
              <span style={{ fontSize: 14, color: C.muted }}>
                <Count value={p.xp} /> / {p.nextXp.toLocaleString()} XP{p.nextTitle ? <> · next title <strong style={{ color: '#fff' }}>{p.nextTitle}</strong></> : null}
              </span>
            </div>
            <div style={{ height: 12, borderRadius: 99, background: '#262B36', overflow: 'hidden' }}><div style={{ height: '100%', width: barPct + '%', background: C.accent, borderRadius: 99, transition: 'width .5s' }} /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#C3C9D4' }}>{paceText(p)}</span>
              <button type="button" onClick={() => setOpen(true)} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.accentLine}`, background: C.accentDim, color: C.accent, fontSize: 13, fontWeight: 700 }}>
                <Svg d="M4 20h16M6 20V10l6-6 6 6v10M10 20v-5h4v5" size={15} sw={2.3} />See what you’ll become
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, flex: '1 1 360px' }}>
            {[[p.streak, 'day streak', '#2A1D12', C.accent2, '#E0C3A3'], [p.bestStreak, 'best streak', C.surface2, undefined, C.muted], [p.freezes, 'streak freeze', C.surface2, undefined, C.muted]].map(([v, l, bg, col, lc]) => (
              <div key={String(l)} style={{ padding: 14, borderRadius: 14, background: bg as string, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: HEAD, fontSize: 28, fontWeight: 700, color: col as string | undefined }}>{v}</span>
                <span style={{ fontSize: 12, color: lc as string }}>{l}</span>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20, alignItems: 'start' }}>
          <section aria-label="Check-in history" style={{ padding: 22, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 18 }}>Last 12 weeks</h2>
              <span style={{ fontSize: 12, color: C.muted }}>Brighter = more check-ins that day</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 10, color: C.dim, paddingRight: 4 }}>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} style={{ height: 18, lineHeight: '18px' }}>{i % 2 === 0 ? labelRows[i / 2] : ''}</span>)}
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 6 }}>
                {weeks.map((col, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {col.map((d) => {
                      const future = d > today;
                      const c = p.days[d]?.checkins ?? 0;
                      const lvl = heatLevel(c, s.goal);
                      return <span key={d} title={`${d}: ${c} check-in${c === 1 ? '' : 's'}`} style={{ height: 18, borderRadius: 4, background: future ? 'transparent' : lvl === 4 ? C.accent : lvl === 0 ? SHADES[0] : `color-mix(in srgb, var(--accent) ${[0, 20, 45, 72][lvl - 1] ?? 0}%, ${SHADES[0]})`, boxShadow: d === today ? '0 0 0 2px #FFFFFF' : 'none' }} />;
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: C.dim, justifyContent: 'flex-end' }}>
              Less
              {[0, 20, 45, 72, 100].map((m) => <span key={m} style={{ width: 14, height: 14, borderRadius: 3, background: m === 0 ? SHADES[0] : m === 100 ? C.accent : `color-mix(in srgb, var(--accent) ${m}%, ${SHADES[0]})` }} />)}
              More
            </div>
          </section>

          <section aria-label="XP this week" style={{ padding: 22, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 18 }}>XP this week</h2>
              <span style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>{p.weekXp.toLocaleString()} XP{pct !== null ? ` · ${pct >= 0 ? '+' : ''}${pct}% vs last week` : ''}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, alignItems: 'end', height: 190 }}>
              {week7.map((d) => {
                const v = p.days[d]?.xp ?? 0;
                const isToday = d === today;
                return (
                  <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 11, color: '#C3C9D4', fontWeight: 600 }}>{d > today ? '' : v}</span>
                    <span style={{ width: '100%', maxWidth: 40, height: Math.max(4, Math.round((v / maxXp) * 140)), borderRadius: '8px 8px 3px 3px', background: isToday ? C.accent : '#3A404D' }} />
                    <span style={{ fontSize: 11, color: isToday ? C.accent : C.dim }}>{DOW_SHORT[dow(d)]}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-label="Daily quests" style={{ padding: 22, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 18 }}>Daily quests</h2>
              <span style={{ fontSize: 12, color: C.muted }}>Reset in {resetsIn(tz)}</span>
            </div>
            {p.quests.map((q) => {
              const [icon, bg, fg] = QUEST_ICON[q.key];
              const complete = q.done >= q.total;
              return (
                <div key={q.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 12, background: C.surface2 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Svg d={icon} size={18} sw={2.2} /></span>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{q.label}</span>
                    <span style={{ height: 6, borderRadius: 99, background: C.border2, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.round((q.done / q.total) * 100) + '%', background: complete ? C.accent : C.blue }} /></span>
                  </span>
                  <span style={{ fontSize: 12, color: C.muted, width: 36, textAlign: 'right' }}>{q.done}/{q.total}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: complete ? C.accent : C.dim, width: 52, textAlign: 'right' }}>+{q.xp} XP</span>
                </div>
              );
            })}
          </section>

          <section aria-label="Badges" style={{ padding: 22, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 18 }}>Badges</h2>
              <span style={{ fontSize: 12, color: C.muted }}>{p.badges.filter((b) => b.on).length} of {p.badges.length}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              {p.badges.map((b) => {
                const [icon, color] = BADGE_ICON[b.key] ?? [ICON.star, '#C6F432'];
                return (
                  <div key={b.key} style={{ padding: '14px 8px', borderRadius: 14, background: b.on ? C.surface2 : 'transparent', border: `1px solid ${b.on ? C.border2 : '#22262F'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: b.on ? color + '22' : '#1A1D24', color: b.on ? color : '#4A5160', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg d={icon} size={20} sw={2.2} /></span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: b.on ? C.text : C.dim }}>{b.label}</span>
                    <span style={{ fontSize: 11, color: C.dim }}>{b.sub}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      <Presence show={open} ms={200}>
        <div data-anim="backdrop" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,6,8,.72)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close title path" style={{ flex: 1, border: 'none', background: 'transparent', cursor: 'default' }} />
          <aside role="dialog" aria-modal="true" aria-label="Your title path" data-anim="drawer" style={{ width: 460, maxWidth: '100%', background: '#14171D', borderLeft: `1px solid ${C.border2}`, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, letterSpacing: '.06em' }}>YOUR TITLE PATH</span>
                <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 26 }}>From Starter to Mythic</h2>
                <span style={{ fontSize: 13, color: C.muted }}>
                  Every title unlocks something.{p.level < 30 ? ` You’re ${(p.nextXp - p.xp).toLocaleString()} XP from the next level.` : ''}
                </span>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Svg d={ICON.close} size={16} sw={2.4} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ladder.map((t) => (
                <div key={t.lvl} style={{ display: 'flex', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flex: 'none' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, background: t.now ? C.accent : t.done ? C.accentDim : C.surface, color: t.now ? 'var(--bg)' : t.done ? C.accent : t.next ? '#FFB36B' : '#5A6273', border: `1px solid ${t.now ? C.accent : t.done ? C.accentLine : t.next ? '#FFB36B' : C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HEAD, fontSize: 15, fontWeight: 700 }}>{t.lvl}</span>
                    <span style={{ flex: 1, width: 2, minHeight: 14, background: t.last ? 'transparent' : t.done ? C.accentLine : '#262B36' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, padding: '4px 0 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontFamily: HEAD, fontSize: 17, fontWeight: 700, color: t.done ? C.muted : t.now || t.next ? '#fff' : C.dim }}>{t.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: t.now ? C.accent : t.done ? C.dim : t.next ? '#FFB36B' : '#5A6273' }}>{t.now ? 'Current' : t.done ? 'Done' : t.next ? 'Next up' : 'Locked'}</span>
                    </div>
                    <span style={{ fontSize: 12, color: C.dim }}>{t.now ? `You are here · ${p.xp.toLocaleString()} XP` : t.done ? 'Reached' : `Needs ${t.xp.toLocaleString()} XP total`}</span>
                    {t.reward && <span style={{ alignSelf: 'flex-start', marginTop: 4, padding: '5px 10px', borderRadius: 8, background: t.done || t.now ? C.accentDim : t.next ? '#2A1D12' : '#1A1D24', color: t.done || t.now ? C.accent : t.next ? '#FFB36B' : C.dim, fontSize: 12 }}>
                      {t.done || t.now ? 'Unlocked' : 'Unlocks'} · {t.reward}
                    </span>}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </Presence>
    </div>
  );
}
