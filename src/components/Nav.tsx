'use client';
import { Count, Link } from '@/components/motion';
import type { CSSProperties, ReactNode } from 'react';
import { useApp } from './store';
import { C, HEAD, ICON, Svg } from './ui';
import { levelPct } from '@/lib/levels';

export const NAV_ITEMS = [
  { label: 'Today', href: '/', d: ICON.today },
  { label: 'Tasks', href: '/tasks', d: ICON.tasks },
  { label: 'Notes', href: '/notes', d: ICON.notes },
  { label: 'Calendar', href: '/calendar', d: ICON.calendar },
  { label: 'Progress', href: '/progress', d: ICON.progress },
  { label: 'Settings', href: '/settings', d: ICON.settings }
] as const;

export function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Svg d="M4 12h4l3-7 4 14 3-7h2" size={18} sw={2.5} color="var(--bg)" />
      </div>
      <span style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 20 }}>Daylog</span>
    </div>
  );
}

export function DesktopNav({
  active, children, showCount, style
}: { active: string; children?: ReactNode; showCount?: boolean; style?: CSSProperties }) {
  const { state } = useApp();
  const pages = state.settings.pages;
  const open = state.tasks.filter((t) => !t.done).length;
  const items = NAV_ITEMS.filter((n) => (pages as Record<string, boolean>)[n.label] !== false);
  return (
    <nav
      aria-label="Main"
      style={{
        flex: '1 1 220px', maxWidth: '100%', padding: '28px 20px', borderRight: '1px solid #1F232C',
        display: 'flex', flexDirection: 'column', gap: 28, background: C.side, ...style
      }}
    >
      <Brand />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((n) => {
          const on = n.label === active;
          return (
            <Link
              key={n.label} href={n.href} prefetch aria-current={on ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 10,
                background: on ? '#1C2029' : 'transparent', color: on ? '#FFFFFF' : C.muted, textDecoration: 'none',
                fontWeight: on ? 600 : 400, fontSize: 14
              }}
            >
              <Svg d={n.d} />
              {n.label}
              {showCount && n.label === 'Tasks' && <span style={{ marginLeft: 'auto', fontSize: 12, color: C.dim }}>{open}</span>}
            </Link>
          );
        })}
      </div>
      {children}
    </nav>
  );
}

export function LevelCard({ long }: { long?: boolean }) {
  const { state } = useApp();
  const p = state.progress;
  const pct = levelPct(p) + '%';
  return (
    <div style={{ marginTop: 'auto', padding: 16, borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: HEAD, fontWeight: 700, fontSize: 16 }}>Level {p.level}</span>
        <span style={{ fontSize: 12, color: C.muted }}>{p.title}</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: '#262B36', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct, background: C.accent, borderRadius: 99, transition: 'width .5s' }} />
      </div>
      <span style={{ fontSize: 12, color: C.muted }}>
        <Count value={p.xp} /> / {p.nextXp.toLocaleString()} XP{long ? ` · ${Math.max(0, p.nextXp - p.xp).toLocaleString()} to Level ${Math.min(30, p.level + 1)}` : ''}
      </span>
    </div>
  );
}

const TABS = [
  { label: 'Today', href: '/', d: ICON.today },
  { label: 'Tasks', href: '/tasks', d: ICON.tasks },
  { label: 'Talk', href: '/voice', d: ICON.mic },
  { label: 'Notes', href: '/notes', d: ICON.notes },
  { label: 'Progress', href: '/progress', d: ICON.progress }
];

export function PhoneTabs({ active }: { active?: string }) {
  const { state, openVoice } = useApp();
  const pages = state.settings.pages as Record<string, boolean>;
  const tabs = TABS.filter((t) => pages[t.label] !== false);
  return (
    <nav
      aria-label="Tabs"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 12px max(22px, env(safe-area-inset-bottom))',
        background: C.side, borderTop: '1px solid #1F232C', display: 'flex', alignItems: 'center', zIndex: 20
      }}
    >
      {tabs.map((tb) => {
        const mic = tb.label === 'Talk';
        const on = tb.label === active;
        const inner = (
          <>
            <span
              style={{
                width: mic ? 58 : 26, height: mic ? 58 : 26, marginTop: mic ? -28 : 0, borderRadius: 99,
                background: mic ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: mic ? `0 8px 28px ${C.glow2}` : undefined
              }}
            >
              <Svg d={tb.d} size={22} sw={2.2} />
            </span>
            {mic ? '' : tb.label}
          </>
        );
        const style = {
          flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 4, padding: '6px 0', border: 'none', background: 'transparent',
          color: mic ? 'var(--bg)' : on ? C.accent : C.dim, fontSize: 11, fontWeight: 600, textDecoration: 'none', minHeight: 48
        };
        return mic ? (
          <button key={tb.label} type="button" onClick={openVoice} aria-label="Talk: log something by voice" style={style}>{inner}</button>
        ) : (
          <Link key={tb.label} href={tb.href} prefetch aria-current={on ? 'page' : undefined} style={style}>{inner}</Link>
        );
      })}
    </nav>
  );
}
