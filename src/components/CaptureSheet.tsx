'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { parseQuick } from '@/lib/parse';
import { addDays, DOW_SHORT, fmtTime, minToHhmm, shortDate, weekStart } from '@/lib/time';
import type { EventKind } from '@/lib/types';
import { useApp, type CaptureReq } from './store';
import { C, HEAD, Pill, Svg, ICON } from './ui';

const inputStyle: CSSProperties = {
  padding: 14, borderRadius: 12, background: C.bg, border: '1px solid #3A404D', color: '#FFFFFF',
  fontSize: 16, fontFamily: 'inherit', outline: 'none', width: '100%', colorScheme: 'dark'
};
const labelStyle: CSSProperties = { fontSize: 12, color: C.muted };
const linkBtn: CSSProperties = { border: 'none', background: 'transparent', color: C.muted, fontSize: 13, textDecoration: 'underline', padding: '6px 2px', minHeight: 32 };

export function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const { phone } = useApp();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,6,8,.7)', display: 'flex', justifyContent: 'center',
        alignItems: phone ? 'flex-end' : 'center', padding: phone ? 0 : 16
      }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={label}
        style={{
          width: phone ? '100%' : 'min(480px, 100%)', maxHeight: '92dvh', overflowY: 'auto', background: C.surface,
          borderRadius: phone ? '24px 24px 0 0' : 24, border: '1px solid #2D3240',
          padding: phone ? '12px 20px max(28px, env(safe-area-inset-bottom))' : 24, display: 'flex', flexDirection: 'column', gap: 16,
          animation: 'sheetIn .22s ease-out'
        }}
      >
        {phone && <span style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 99, background: '#3A404D' }} />}
        {children}
      </div>
    </div>
  );
}

export function CaptureSheet() {
  const { capture, closeCapture } = useApp();
  if (!capture) return null;
  return <Inner key={JSON.stringify(capture)} req={capture} onClose={closeCapture} />;
}

function Inner({ req, onClose }: { req: CaptureReq; onClose: () => void }) {
  const { state, today, act, flash } = useApp();
  const s = state.settings;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const [busy, setBusy] = useState(false);

  // shared
  const [title, setTitle] = useState(('title' in req && req.title) || '');
  const [tag, setTag] = useState<string | null>(req.type === 'task' ? req.tag ?? null : null);

  // task
  const [when, setWhen] = useState<'No date' | 'Today' | 'Tomorrow' | 'This week' | 'Pick date'>('No date');
  const [touched, setTouched] = useState(false);
  const [literal, setLiteral] = useState(false);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  const [date, setDate] = useState(req.type === 'event' && req.date ? req.date : today);
  const [time, setTime] = useState('');

  // note
  const [body, setBody] = useState(req.type === 'note' ? req.body ?? '' : '');

  // event
  const editing = req.type === 'event' ? req.edit : undefined;
  const [start, setStart] = useState(editing ? minToHhmm(editing.startMin) : '09:00');
  const [end, setEnd] = useState(editing ? minToHhmm(editing.endMin) : '09:30');
  const [kind, setKind] = useState<EventKind>(editing?.kind ?? 'event');
  const [repeat, setRepeat] = useState<number[]>(editing?.repeatDays ?? []);
  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDate(editing.date);
    }
  }, [editing]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    let ok = false;
    if (req.type === 'task') {
      if (!title.trim()) return setBusy(false);
      const explicit: Record<string, unknown> = {};
      if (touched) {
        if (when === 'No date') explicit.dueDate = null;
        if (when === 'Today') explicit.dueDate = today;
        if (when === 'Tomorrow') explicit.dueDate = addDays(today, 1);
        if (when === 'This week') explicit.dueDate = addDays(weekStart(today, s.week), 6);
        if (when === 'Pick date') {
          explicit.dueDate = date;
          explicit.dueTime = time || null;
        }
      }
      // An explicit "When" choice wins over anything detected in the title; "Ignore" keeps the title literal.
      ok = !!(await act('POST', '/api/tasks', { title, tag, parse: !literal, ...explicit }));
    } else if (req.type === 'note') {
      if (!title.trim() && !body.trim()) return setBusy(false);
      ok = !!(await act('POST', '/api/notes', { title, body, tag, source: req.evening ? 'evening' : 'typed' }));
    } else {
      if (!title.trim()) return setBusy(false);
      const payload = { title, kind, date, start, end, repeatDays: kind === 'habit' ? repeat : null };
      ok = editing
        ? !!(await act('PATCH', `/api/events/${editing.id}`, payload))
        : !!(await act('POST', '/api/events', { ...payload, linkNoteId: req.linkNoteId }));
    }
    setBusy(false);
    if (ok) onClose();
  };

  const heading =
    req.type === 'task' ? 'New task' : req.type === 'note' ? (req.evening ? 'Evening check-in' : 'New note') : editing ? 'Edit event' : 'New event';
  const cta =
    req.type === 'event' && editing ? 'Save changes' : req.type === 'task' ? 'Add · +5 XP' : req.type === 'note' ? 'Save · +5 XP' : 'Add · +5 XP';

  const chips = (tags: [string, string][]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>Tag</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill on={tag === null} onClick={() => setTag(null)}>Auto</Pill>
        {tags.map(([t]) => (
          <Pill key={t} on={tag === t} onClick={() => setTag(t)}>{t}</Pill>
        ))}
      </div>
    </div>
  );

  return (
    <Modal label={heading} onClose={onClose}>
      <form
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <label htmlFor="cap-title" style={{ fontFamily: HEAD, fontSize: 18, fontWeight: 700 }}>{heading}</label>
        {req.type === 'note' && req.evening && (
          <span style={{ fontSize: 13, color: '#E0C68E' }}>What was the best part of today? One line is enough.</span>
        )}
        <input
          id="cap-title" ref={ref} value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} autoComplete="off"
          placeholder={req.type === 'task' ? 'What needs doing?' : req.type === 'note' ? (req.evening ? 'Best part of the day' : 'Title') : 'Event title'}
        />

        {req.type === 'task' && (
          <>
            {(() => {
              const p = literal ? null : parseQuick(title, today);
              const bits = p ? [!touched && p.date ? shortDate(p.date) : null, p.time && (!touched || when !== 'No date') ? fmtTime(p.time, s.time) : null, p.tag].filter(Boolean) : [];
              if (literal) {
                return (
                  <span style={{ ...labelStyle, marginTop: -8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    Saving the title exactly as typed.
                    <button type="button" onClick={() => setLiteral(false)} style={linkBtn}>Detect date and time again</button>
                  </span>
                );
              }
              if (!bits.length) return <span style={{ ...labelStyle, marginTop: -8 }}>Tip: type “fri 6pm #work” and Daylog fills in the date, time and tag.</span>;
              return (
                <span aria-live="polite" style={{ marginTop: -8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: C.accent }}>
                  Detected: {bits.join(' · ')}
                  <button type="button" onClick={() => setLiteral(true)} style={linkBtn}>Ignore</button>
                </span>
              );
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>When</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['No date', 'Today', 'Tomorrow', 'This week', 'Pick date'] as const).map((w) => (
                  <Pill key={w} on={when === w} onClick={() => { setWhen(w); setTouched(true); }}>{w}</Pill>
                ))}
              </div>
              {when === 'Pick date' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, fontSize: 15 }} />
                  <input aria-label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...inputStyle, fontSize: 15, width: 130 }} />
                </div>
              )}
            </div>
            {chips(s.taskTags)}
          </>
        )}

        {req.type === 'note' && (
          <>
            <label htmlFor="cap-body" style={{ position: 'absolute', left: -9999 }}>Note</label>
            <textarea
              id="cap-body" value={body} onChange={(e) => setBody(e.target.value)} rows={5}
              placeholder="Write it down…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
            {chips(s.noteTags)}
          </>
        )}

        {req.type === 'event' && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([['event', 'Event'], ['task', 'Time block'], ['habit', 'Habit']] as const).map(([k, l]) => (
                <Pill key={k} on={kind === k} onClick={() => setKind(k)}>{l}</Pill>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, fontSize: 15, flex: '1 1 150px', width: 'auto' }} />
              <input aria-label="Start" type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inputStyle, fontSize: 15, flex: '1 1 100px', width: 'auto' }} />
              <input aria-label="End" type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...inputStyle, fontSize: 15, flex: '1 1 100px', width: 'auto' }} />
            </div>
            {kind === 'habit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={labelStyle}>Repeats on</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <Pill
                      key={d} on={repeat.includes(d)} style={{ padding: '9px 12px' }}
                      onClick={() => setRepeat((r) => (r.includes(d) ? r.filter((x) => x !== d) : [...r, d]))}
                    >
                      {DOW_SHORT[d]}
                    </Pill>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {editing && (
            <button
              type="button" aria-label={armed ? 'Confirm delete' : editing.repeatDays?.length ? 'Delete habit (every day it repeats)' : 'Delete event'} disabled={busy}
              onClick={async () => {
                if (!armed) return setArmed(true);
                setBusy(true);
                if (await act('DELETE', `/api/events/${editing.id}`)) { flash(editing.repeatDays?.length ? 'Habit deleted' : 'Event deleted'); onClose(); }
                setBusy(false);
              }}
              style={{ padding: armed ? '14px 16px' : 14, borderRadius: 14, border: `1px solid ${armed ? '#FF7A6B' : '#5C2A24'}`, background: armed ? '#FF7A6B' : 'transparent', color: armed ? '#1E1412' : '#FF9E92', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}
            >
              <Svg d={ICON.trash} size={18} />
              {armed && 'Delete?'}
            </button>
          )}
          <button type="button" onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid #3A404D', background: 'transparent', color: C.text, fontSize: 15, fontWeight: 600 }}>
            Cancel
          </button>
          <button type="submit" disabled={busy} style={{ flex: 2, padding: 14, borderRadius: 14, border: 'none', background: C.accent, color: 'var(--bg)', fontSize: 15, fontWeight: 700, opacity: busy ? 0.7 : 1 }}>
            {cta}
          </button>
        </div>
        {armed && editing && (
          <span role="alert" style={{ fontSize: 12, color: '#FF9E92', marginTop: -6 }}>
            {editing.repeatDays?.length ? 'This removes the habit from every day it repeats. Tap Delete? again to confirm.' : 'Tap Delete? again to confirm.'}
          </span>
        )}
      </form>
    </Modal>
  );
}
