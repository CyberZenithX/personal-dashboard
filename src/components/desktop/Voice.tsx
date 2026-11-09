'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import { useApp } from '../store';
import { C, ICON, Svg, useDialogFocus, visuallyHidden } from '../ui';
import { fmtElapsed, useVoice } from '../useVoice';
import { fmtTime, shortDate } from '@/lib/time';
import type { SortItem } from '@/lib/types';

const TYPE = {
  task: { label: 'TASK', color: '#7FB2FF', icon: 'M9 11l3 3 8-8' },
  event: { label: 'EVENT', color: '#D59CFF', icon: 'M5 5h14a2 2 0 0 1 2 2v14H3V7a2 2 0 0 1 2-2zM3 10h18' },
  note: { label: 'NOTE', color: '#FFC85C', icon: ICON.pencil },
  complete: { label: 'DONE', color: 'var(--accent)', icon: ICON.check }
} as const;

export function itemSub(it: SortItem, mode: '24h' | '12h', title?: string): string {
  const bits: string[] = [];
  if (it.type === 'complete') return `Matched your task${title ? ` · ${title}` : ''}`;
  if (it.date) bits.push(shortDate(it.date));
  if (it.time) bits.push(fmtTime(it.time, mode) + (it.type === 'event' && it.endTime ? '–' + fmtTime(it.endTime, mode) : ''));
  if (it.tag) bits.push(it.tag);
  return bits.join(' · ') || (it.type === 'note' ? 'Untagged' : 'No date');
}

/** In review: fix the title, what kind of item it is, its tag and (for events) when. */
export function ReviewFields({ it, onChange }: { it: SortItem; onChange: (patch: Partial<SortItem>) => void }) {
  const { state, today } = useApp();
  const s = state.settings;
  if (it.type === 'complete') return null;
  const tags = it.type === 'note' ? s.noteTags : it.type === 'task' ? s.taskTags : [...s.taskTags, ...s.noteTags];
  const field: CSSProperties = { padding: '7px 9px', borderRadius: 8, background: C.bg, border: '1px solid #3A404D', color: '#fff', fontSize: 13, colorScheme: 'dark', minWidth: 0, minHeight: 34 };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input aria-label="Title" value={it.title} onChange={(e) => onChange({ title: e.target.value })} style={{ ...field, fontSize: 14, fontWeight: 600 }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <select aria-label="Save as" value={it.type} onChange={(e) => {
          const type = e.target.value as SortItem['type'];
          onChange(type === 'event' ? { type, time: it.time ?? '09:00', date: it.date ?? today } : { type, tag: (type === 'note' ? s.noteTags : s.taskTags).some((t) => t[0] === it.tag) ? it.tag : null });
        }} style={field}>
          <option value="task">Task</option>
          <option value="note">Note</option>
          <option value="event">Event</option>
        </select>
        <select aria-label="Tag" value={it.tag ?? ''} onChange={(e) => onChange({ tag: e.target.value || null })} style={field}>
          <option value="">Untagged</option>
          {[...new Set([...tags.map((t) => t[0]), ...(it.tag ? [it.tag] : [])])].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {it.type !== 'note' && (
          <input aria-label="Date" type="date" value={it.date ?? ''} onChange={(e) => onChange({ date: e.target.value || null })} style={field} />
        )}
        {it.type !== 'note' && it.date && (
          <input aria-label="Time" type="time" value={it.time ?? ''} onChange={(e) => onChange({ time: e.target.value || null })} style={field} />
        )}
      </div>
    </div>
  );
}

export default function Voice({ onClose, overlay }: { onClose: () => void; overlay?: boolean }) {
  const v = useVoice(onClose);
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box);
  const { state } = useApp();
  const s = state.settings;
  const lastIsNote = v.items.length > 0 && v.items[v.items.length - 1].type === 'note';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') v.cancel();
      const t = e.target as HTMLElement;
      if (e.key === 'Enter' && t.tagName !== 'TEXTAREA' && !t.closest('button, a, [role="button"]')) {
        e.preventDefault();
        void (v.mode === 'review' ? v.saveReview() : v.finish());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const listening = v.mode === 'listening';
  return (
    <div style={{ minHeight: '100dvh', background: overlay ? 'rgba(5,6,8,.86)' : '#07080B', color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="voice-h" style={{ outline: 'none', width: '100%', maxWidth: 880, borderRadius: 24, background: '#14171D', border: '1px solid #262B36', padding: 36, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <h1 id="voice-h" style={visuallyHidden}>Voice capture</h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: listening && v.ready && v.supported && !v.showTyping ? '#FF6B5C' : '#5A6273' }} />
            <span style={{ fontSize: 14, fontWeight: 600 }} role="status">
              {listening ? (v.supported && !v.showTyping ? (v.starting || !v.ready ? 'Starting microphone…' : `Listening · ${fmtElapsed(v.elapsed)}`) : 'Type or dictate') : v.mode === 'review' ? 'Review before saving' : 'Saving…'}
            </span>
          </div>
          <span style={{ fontSize: 12, color: C.muted, padding: '6px 10px', borderRadius: 99, border: `1px solid ${C.border2}` }}>
            {v.chip}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          {v.supported && !v.showTyping ? (
            <>
              <div style={{ width: 96, height: 96, borderRadius: 99, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: listening && v.ready ? 'pulse 1.6s infinite' : undefined, opacity: listening && v.ready ? 1 : 0.5 }}>
                <Svg d={ICON.mic} size={40} sw={2.2} color="var(--bg)" />
              </div>
              <div aria-hidden="true" style={{ display: 'flex', gap: 5, alignItems: 'center', height: 40 }}>
                {[0, 0.15, 0.3, 0.45, 0.6, 0.45, 0.3, 0.15].map((d, i) => (
                  <span key={i} style={{ width: 5, height: 40, borderRadius: 9, background: C.accent, animation: listening ? `bar 1s infinite ${d}s` : undefined, transform: listening ? undefined : 'scaleY(.35)' }} />
                ))}
              </div>
              <p style={{ margin: 0, maxWidth: 640, textAlign: 'center', fontSize: 22, lineHeight: 1.5, color: '#fff', minHeight: 33 }}>
                {v.text ? <>“{v.finalText}<span style={{ color: C.dim }}>{v.interim}{listening ? '…' : ''}</span>”</> : <span style={{ color: C.dim }}>Say something — “Remind me to send the clinic quote Tuesday morning…”</span>}
              </p>
            </>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {v.error && <span role="alert" style={{ fontSize: 13, color: C.accent2 }}>{v.error}</span>}
              <label htmlFor="typed" style={{ fontSize: 13, color: C.muted }}>Type what you want to log — or use your keyboard’s dictation key.</label>
              <textarea id="typed" autoFocus value={v.typed} onChange={(e) => v.setTyped(e.target.value)} rows={4} placeholder="Remind me to send the clinic quote Tuesday morning, put a call with Bilal Thursday at 4…" style={{ padding: 16, borderRadius: 14, background: C.bg, border: '1px solid #3A404D', color: '#fff', fontSize: 18, lineHeight: 1.5, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          )}
          {v.supported && listening && (
            <button type="button" onClick={() => v.setShowTyping(!v.showTyping)} style={{ border: 'none', background: 'transparent', color: C.muted, fontSize: 13, textDecoration: 'underline' }}>
              {v.showTyping ? 'Use the microphone' : 'Type instead'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 12, color: C.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Sorted with your tags · {v.items.length} item{v.items.length === 1 ? '' : 's'}{v.sorting ? ' · sorting…' : ''}
          </span>
          {!v.items.length && <span style={{ fontSize: 13, color: C.dim }}>Tasks, notes and events will appear here as you speak.</span>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
            {v.items.map((it, i) => {
              const t = TYPE[it.type];
              const live = listening && lastIsNote && i === v.items.length - 1;
              const matched = it.type === 'complete' ? state.tasks.find((x) => x.id === it.taskId) : undefined;
              return (
                <div key={i} style={{ position: 'relative', padding: 16, borderRadius: 14, background: it.type === 'complete' ? C.accentRow : '#1C2029', border: `1px ${live ? 'dashed' : 'solid'} ${live ? '#4A5160' : it.type === 'complete' ? C.accentLine : C.border2}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: t.color }}>
                    <Svg d={t.icon} size={14} sw={2.4} />{t.label}{live ? ' · still listening' : ''}
                  </span>
                  {v.mode === 'review' && it.type !== 'complete' ? (
                    <div style={{ paddingRight: 28 }}><ReviewFields it={it} onChange={(patch) => v.updateItem(i, patch)} /></div>
                  ) : (
                    <>
                      <span style={{ fontSize: 15, fontWeight: 600, paddingRight: v.mode === 'review' ? 28 : 0 }}>{it.type === 'complete' ? `${it.title} marked done` : it.title}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>{itemSub(it, s.time, matched?.title)}</span>
                    </>
                  )}
                  {v.mode === 'review' && (
                    <button type="button" aria-label={`Remove ${it.title}`} onClick={() => v.removeItem(i)} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Svg d={ICON.close} size={14} sw={2.6} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid #262B36' }}>
          <span style={{ fontSize: 13, color: C.accent, fontWeight: 600, paddingTop: 16 }}>+{v.xp} XP when saved · counts as a check-in</span>
          <div style={{ display: 'flex', gap: 10, paddingTop: 16 }}>
            <button type="button" onClick={v.cancel} style={{ padding: '12px 18px', borderRadius: 12, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600 }}>Cancel</button>
            <button type="button" disabled={v.mode === 'saving'} onClick={() => (v.mode === 'review' ? v.saveReview() : v.finish())} style={{ padding: '12px 22px', borderRadius: 12, border: 'none', background: C.accent, color: 'var(--bg)', fontSize: 14, fontWeight: 700, opacity: v.mode === 'saving' ? 0.6 : 1 }}>
              Save all · Enter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
