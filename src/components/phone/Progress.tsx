'use client';
import Link from 'next/link';
import { useApp } from '../store';
import { C, HEAD, ICON, Svg } from '../ui';
import { heatLevel, paceText, resetsIn } from '../desktop/Progress';
import { addDays, DOW_SHORT, dow, weekStart } from '@/lib/time';
import { levelPct } from '@/lib/levels';

const QUEST_COLORS = (done: boolean) => ({ bar: done ? C.accent : C.blue, xp: done ? C.accent : C.muted });
const BADGE: Record<string, [string, string]> = {
  'first-week': [ICON.flame, '#FFB36B'], talker: [ICON.mic, '#C6F432'], closer: ['M5 12l5 5 9-10', '#7FB2FF'],
  'early-bird': ['M12 3v2M5 12H3M21 12h-2M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10', '#FFC85C'], perfect: [ICON.star, '#D59CFF'],
  month: ['M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5', '#FFB36B'], thinker: ['M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6', '#FFC85C'],
  zero: ['M4 13l4 4L20 5', '#7FB2FF'], warrior: [ICON.bolt, '#C6F432'], scribe: [ICON.pencil, '#FFC85C'],
  linked: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', '#7FB2FF'], architect: ['M4 20h16M6 20V10l6-6 6 6v10M10 20v-5h4v5', '#D59CFF']
};

export default function PhoneProgress() {
  const { state, today, tz } = useApp();
  const p = state.progress;
  const s = state.settings;
  const start = addDays(weekStart(today, s.week), -21);
  const cells = Array.from({ length: 28 }, (_, i) => addDays(start, i));
  const heads = Array.from({ length: 7 }, (_, i) => DOW_SHORT[(dow(start) + i) % 7][0]);
  const bar = levelPct(p);
  const card = { padding: 18, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' as const };

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100dvh' }}>
      <div style={{ padding: '24px 20px 130px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 26 }}>Progress</h1>
          <Link href="/settings" aria-label="Settings" style={{ width: 44, height: 44, borderRadius: 99, background: C.surface, color: '#C3C9D4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg d={ICON.settings} size={18} sw={2.2} /></Link>
        </div>

        <section aria-label="Level" style={{ ...card, gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: C.accent, color: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em' }}>LEVEL</span>
              <span style={{ fontFamily: HEAD, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{p.level}</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: HEAD, fontSize: 20, fontWeight: 700 }}>{p.title}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{p.level >= 30 ? 'Final level' : `${(p.nextXp - p.xp).toLocaleString()} XP to ${p.nextTitle && p.nextTitle !== p.title ? p.nextTitle : 'Level ' + (p.level + 1)}`}</span>
            </div>
          </div>
          <div style={{ height: 10, borderRadius: 99, background: '#262B36', overflow: 'hidden' }}><div style={{ height: '100%', width: bar + '%', background: C.accent }} /></div>
          <span style={{ fontSize: 12, color: C.muted }}>{paceText(p)}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[[p.streak, 'streak', '#2A1D12', C.accent2, '#E0C3A3'], [p.bestStreak, 'best', C.surface2, undefined, C.muted], [p.freezes, 'freeze', C.surface2, undefined, C.muted]].map(([v, l, bg, col, lc]) => (
              <div key={String(l)} style={{ padding: 10, borderRadius: 12, background: bg as string, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontFamily: HEAD, fontSize: 20, fontWeight: 700, color: col as string | undefined }}>{v}</span>
                <span style={{ fontSize: 11, color: lc as string }}>{l}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Last 4 weeks" style={{ ...card, gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Last 4 weeks</h2>
            <span style={{ fontSize: 11, color: C.muted, letterSpacing: '.3em' }}>{heads.join(' ')}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
            {cells.map((d) => {
              const lvl = heatLevel(p.days[d]?.checkins ?? 0, s.goal);
              return <span key={d} title={d} style={{ height: 32, borderRadius: 7, background: d > today ? 'transparent' : lvl === 0 ? '#22262F' : lvl === 4 ? C.accent : `color-mix(in srgb, var(--accent) ${[20, 45, 72][lvl - 1]}%, #22262F)`, boxShadow: d === today ? '0 0 0 2px #FFFFFF' : 'none' }} />;
            })}
          </div>
        </section>

        <section aria-label="Daily quests" style={{ ...card, gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Daily quests</h2>
            <span style={{ fontSize: 11, color: C.muted }}>Resets in {resetsIn(tz)}</span>
          </div>
          {p.quests.map((q) => {
            const c = QUEST_COLORS(q.done >= q.total);
            return (
              <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{q.label}</span><span style={{ fontWeight: 700, color: c.xp }}>{q.done}/{q.total} · +{q.xp}</span></div>
                <span style={{ height: 6, borderRadius: 99, background: C.border2, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.round((q.done / q.total) * 100) + '%', background: c.bar }} /></span>
              </div>
            );
          })}
        </section>

        <section aria-label="Badges" style={{ ...card, gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Badges</h2>
            <span style={{ fontSize: 11, color: C.muted }}>{p.badges.filter((b) => b.on).length} of {p.badges.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {p.badges.map((b) => {
              const [icon, color] = BADGE[b.key] ?? [ICON.star, '#C6F432'];
              return (
                <div key={b.key} title={b.sub} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
                  <span style={{ width: 52, height: 52, borderRadius: 16, background: b.on ? color + '22' : '#14171D', color: b.on ? color : '#4A5160', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${b.on ? color + '55' : '#22262F'}` }}><Svg d={icon} size={22} sw={2.2} /></span>
                  <span style={{ fontSize: 11, color: b.on ? C.text : C.dim }}>{b.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
