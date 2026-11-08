'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { C, HEAD, Svg, ICON } from '../ui';
import { addDays, DOW_SHORT, fmtClockHour, fmtMin, hhmmToMin, minutesOfDay, MONTH_LONG, MONTH_SHORT, parts, weekStart, dow } from '@/lib/time';
import { eventsOn } from '@/lib/view';

const H = 56;
const KINDS = {
  event: { bg: '#2A1C33', fg: '#E7C8FF' },
  task: { bg: '#1A2638', fg: '#B9D5FF' },
  habit: { bg: '#2E2614', fg: '#FFE0A3' }
} as const;

interface Block {
  key: string; title: string; start: number; end: number; kind: keyof typeof KINDS; eventId?: number; taskId?: number; lane: number; lanes: number;
}

function layout(blocks: Omit<Block, 'lane' | 'lanes'>[]): Block[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((b) => b.lane + 1));
    cluster.forEach((b) => (b.lanes = lanes));
    out.push(...cluster);
    cluster = [];
  };
  const laneEnds: number[] = [];
  for (const b of sorted) {
    if (b.start >= clusterEnd && cluster.length) { flush(); laneEnds.length = 0; }
    let lane = laneEnds.findIndex((e) => e <= b.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = b.end;
    cluster.push({ ...b, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, b.end);
  }
  if (cluster.length) flush();
  return out;
}

export default function Calendar() {
  const { state, today, tz, phone, openCapture, openTaskMenu } = useApp();
  const s = state.settings;
  const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Week');
  const [anchor, setAnchor] = useState(today);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    if (scrollRef.current && !scrolled.current) {
      scrolled.current = true;
      scrollRef.current.scrollTop = 6 * H;
    }
  });

  const ws = weekStart(anchor, s.week);
  const days = view === 'Day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const blocksFor = (day: string): Block[] => {
    const raw: Omit<Block, 'lane' | 'lanes'>[] = [];
    eventsOn(state.events, day).forEach((e) => raw.push({ key: 'e' + e.id, title: e.title, start: e.startMin, end: e.endMin, kind: e.kind, eventId: e.id }));
    state.tasks.filter((t) => t.dueDate === day && t.dueTime).forEach((t) => {
      const st = hhmmToMin(t.dueTime) ?? 0;
      raw.push({ key: 't' + t.id, title: t.title, start: st, end: Math.min(1440, st + 60), kind: 'task', taskId: t.id });
    });
    return layout(raw);
  };

  const title = useMemo(() => {
    if (view === 'Day') {
      const { m, d } = parts(anchor);
      return `${DOW_SHORT[dow(anchor)]} ${d} ${MONTH_LONG[m - 1]}`;
    }
    if (view === 'Month') {
      const { y, m } = parts(anchor);
      return `${MONTH_LONG[m - 1]} ${y}`;
    }
    const a = parts(ws), b = parts(addDays(ws, 6));
    return a.m === b.m ? `${a.d} – ${b.d} ${MONTH_LONG[b.m - 1]}` : `${a.d} ${MONTH_SHORT[a.m - 1]} – ${b.d} ${MONTH_SHORT[b.m - 1]}`;
  }, [view, anchor, ws]);

  const step = (dir: number) => {
    if (view === 'Day') setAnchor(addDays(anchor, dir));
    else if (view === 'Week') setAnchor(addDays(anchor, 7 * dir));
    else {
      const { y, m } = parts(anchor);
      const nd = new Date(Date.UTC(y, m - 1 + dir, 1));
      setAnchor(nd.toISOString().slice(0, 10));
    }
  };

  const scored = days.filter((d) => d <= today && (state.progress.days[d]?.score ?? 0) > 0);
  const avg = scored.length ? Math.round(scored.reduce((a, d) => a + state.progress.days[d].score, 0) / scored.length) : 0;
  const nowMin = minutesOfDay(new Date(), tz);

  const viewBtn = (v: typeof view) => (
    <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${view === v ? C.accent : C.border2}`, background: view === v ? C.accentDim : 'transparent', color: view === v ? C.accent : C.muted, fontSize: 13, fontWeight: view === v ? 600 : 400 }}>{v}</button>
  );
  const navBtn = (label: string, onClick: () => void, d: string) => (
    <button type="button" aria-label={label} onClick={onClick} style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Svg d={d} sw={2.2} />
    </button>
  );

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, padding: phone ? '20px 16px 32px' : '32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Link href="/" aria-label="Back to Today" style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text }}>
            <Svg d={ICON.back} sw={2.2} />
          </Link>
          <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 28 }}>{title}</h1>
          <div style={{ display: 'flex', gap: 6 }}>
            {navBtn('Previous', () => step(-1), ICON.back)}
            <button type="button" onClick={() => setAnchor(today)} style={{ padding: '0 12px', height: 40, borderRadius: 12, border: `1px solid ${C.border2}`, background: 'transparent', color: C.muted, fontSize: 13 }}>Today</button>
            {navBtn('Next', () => step(1), ICON.chevron)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['Day', 'Week', 'Month'] as const).map(viewBtn)}
          <button type="button" onClick={() => openCapture({ type: 'event', date: view === 'Month' ? today : anchor })} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.accent, color: 'var(--bg)', fontSize: 13, fontWeight: 700 }}>+ Event</button>
        </div>
      </header>

      {view !== 'Month' ? (
        <div ref={scrollRef} className="dl-scroll" tabIndex={0} aria-label="Calendar grid, scroll for all 24 hours" style={{ overflow: 'auto', maxHeight: 'calc(100dvh - 190px)', minHeight: 420, borderRadius: 18, border: `1px solid ${C.border}`, background: '#14171D' }}>
          <div style={{ minWidth: view === 'Day' ? 0 : 980, display: 'grid', gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 3, background: '#14171D', borderBottom: `1px solid ${C.border}` }} />
            {days.map((d) => {
              const isToday = d === today;
              const sc = state.progress.days[d]?.score ?? 0;
              const future = d > today;
              return (
                <div key={d} style={{ position: 'sticky', top: 0, zIndex: 2, padding: '14px 12px', borderBottom: `1px solid ${C.border}`, borderLeft: '1px solid #1F232C', display: 'flex', flexDirection: 'column', gap: 8, background: isToday ? C.accentRow : '#14171D' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>{DOW_SHORT[dow(d)]}</span>
                    <span style={{ fontFamily: HEAD, fontSize: 20, fontWeight: 700, color: isToday ? C.accent : '#fff' }}>{parts(d).d}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#262B36', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: sc + '%', background: sc >= 80 ? C.accent : sc >= 70 ? '#9FBF3A' : '#FFB36B', borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#C3C9D4', fontWeight: 600, minWidth: 14 }}>{future ? '' : sc}</span>
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} style={{ height: H, padding: '4px 10px 0 0', textAlign: 'right', fontSize: 11, color: C.dim }}>{fmtClockHour(h, s.time)}</div>
              ))}
            </div>
            {days.map((d) => (
              <div key={d} style={{ position: 'relative', height: 24 * H, overflow: 'hidden', borderLeft: '1px solid #1F232C', backgroundImage: 'linear-gradient(#1F232C 1px, transparent 1px)', backgroundSize: `100% ${H}px`, backgroundColor: d === today ? C.accentRow2 : 'transparent' }}>
                {blocksFor(d).map((b) => {
                  const k = KINDS[b.kind] ?? KINDS.event;
                  const done = b.taskId ? state.tasks.find((t) => t.id === b.taskId)?.done : false;
                  return (
                    <button
                      key={b.key} type="button"
                      onClick={() => (b.eventId ? openCapture({ type: 'event', edit: state.events.find((e) => e.id === b.eventId) }) : b.taskId && openTaskMenu(b.taskId))}
                      style={{
                        position: 'absolute', left: `calc(${(b.lane / b.lanes) * 100}% + 6px)`, width: `calc(${100 / b.lanes}% - 12px)`,
                        top: b.start / 60 * H + 2, height: Math.max(22, (b.end - b.start) / 60 * H - 4), padding: '8px 10px', borderRadius: 10, border: 'none',
                        background: k.bg, color: k.fg, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', opacity: done ? 0.55 : 1
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, textDecoration: done ? 'line-through' : 'none' }}>{b.title}</span>
                      <span style={{ fontSize: 11, opacity: 0.85 }}>{fmtMin(b.start, s.time)}–{fmtMin(b.end, s.time)}</span>
                    </button>
                  );
                })}
                {d === today && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: (nowMin / 60) * H, height: 2, background: C.accent, pointerEvents: 'none' }}>
                    <span style={{ position: 'absolute', left: -5, top: -4, width: 10, height: 10, borderRadius: 99, background: C.accent }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <MonthGrid anchor={anchor} onPick={(d) => { setAnchor(d); setView('Day'); }} />
      )}

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: C.muted, alignItems: 'center' }}>
        {([['Events', '#D59CFF'], ['Time-blocked tasks', '#7FB2FF'], ['Habits', '#FFC85C']] as const).map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}</span>
        ))}
        <span style={{ marginLeft: phone ? 0 : 'auto' }}>
          Scroll the grid for the full 24 hours. Bar under each date = that day’s score. {view === 'Day' ? '' : <>Week average: <strong style={{ color: C.accent }}>{avg}</strong></>}
        </span>
      </div>
    </div>
  );
}

function MonthGrid({ anchor, onPick }: { anchor: string; onPick: (d: string) => void }) {
  const { state, today } = useApp();
  const s = state.settings;
  const { y, m } = parts(anchor);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const start = weekStart(first, s.week);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const heads = Array.from({ length: 7 }, (_, i) => DOW_SHORT[(dow(start) + i) % 7]);
  return (
    <div style={{ overflowX: 'auto', borderRadius: 18, border: `1px solid ${C.border}`, background: '#14171D' }}>
      <div style={{ minWidth: 640, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {heads.map((h) => <div key={h} style={{ padding: '12px', fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${C.border}` }}>{h}</div>)}
        {cells.map((d) => {
          const inMonth = parts(d).m === m;
          const evs = [
            ...eventsOn(state.events, d).map((e) => ({ t: e.title, k: e.kind })),
            ...state.tasks.filter((t) => t.dueDate === d && t.dueTime).map((t) => ({ t: t.title, k: 'task' as const }))
          ];
          return (
            <button key={d} type="button" onClick={() => onPick(d)} style={{ minHeight: 104, padding: 8, border: 'none', borderLeft: '1px solid #1F232C', borderBottom: '1px solid #1F232C', background: d === today ? C.accentRow : 'transparent', color: inMonth ? C.text : '#5A6273', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 700, color: d === today ? C.accent : undefined }}>{parts(d).d}</span>
              {evs.slice(0, 3).map((e, i) => (
                <span key={i} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, background: KINDS[e.k].bg, color: KINDS[e.k].fg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{e.t}</span>
              ))}
              {evs.length > 3 && <span style={{ fontSize: 11, color: C.dim }}>+{evs.length - 3} more</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
