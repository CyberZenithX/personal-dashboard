'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NoteDetail } from '../NoteDetail';
import { useApp } from '../store';
import { C, HEAD, ICON, Svg, useDialogFocus } from '../ui';
import { fmtTime, timeOfDayFromIso } from '@/lib/time';
import type { Note } from '@/lib/types';
import { allTagColor, dayLabel, kindLabel } from '@/lib/view';

export default function PhoneNotes() {
  const { state, today, tz, openCapture, allNotes, moreNotes, loadOlder } = useApp();
  const s = state.settings;
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('All');
  const [open, setOpen] = useState<number | null>(null);
  const params = useSearchParams();
  useEffect(() => {
    const id = Number(params.get('note'));
    if (id) setOpen(id);
  }, [params]);

  const list = allNotes.filter((n) =>
    (chip === 'All' || (chip === 'From voice' ? n.source === 'voice' : n.tag === chip)) &&
    (!q.trim() || (n.title + ' ' + n.body).toLowerCase().includes(q.trim().toLowerCase()))
  );
  const groups: { label: string; notes: Note[] }[] = [];
  for (const n of list) {
    const label = dayLabel(n.createdAt, today, tz).toUpperCase();
    const g = groups.find((x) => x.label === label);
    if (g) g.notes.push(n); else groups.push({ label, notes: [n] });
  }
  const eveningDone = allNotes.some((n) => n.source === 'evening' && dayLabel(n.createdAt, today, tz) === 'Today');
  const cur = allNotes.find((n) => n.id === open);

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100dvh' }}>
      <div style={{ padding: '24px 20px 130px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 26 }}>Notes</h1>
          <span style={{ fontSize: 13, color: C.muted }}>{allNotes.length}{moreNotes ? '+' : ''} note{allNotes.length === 1 ? '' : 's'}</span>
        </div>
        <label htmlFor="msearch" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: 12, background: C.surface, border: `1px solid ${C.border2}` }}>
          <Svg d={ICON.search} size={16} sw={2.2} color={C.dim} />
          <input id="msearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything" style={{ flex: 1, minWidth: 0, padding: '13px 0', background: 'transparent', border: 'none', color: '#fff', fontSize: 16, outline: 'none' }} />
        </label>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px', flex: 'none' }}>
          {['All', ...s.noteTags.map((t) => t[0]), 'From voice'].map((c) => (
            <button key={c} type="button" aria-pressed={chip === c} onClick={() => setChip(c)} style={{ flex: 'none', padding: '7px 12px', borderRadius: 99, border: `1px solid ${chip === c ? '#5A6273' : C.border2}`, background: chip === c ? '#1C2029' : 'transparent', color: c === 'All' ? '#fff' : c === 'From voice' ? C.accent : allTagColor(s, c), fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', minHeight: 36 }}>
              {c === 'All' || c === 'From voice' ? c : c.slice(1).replace(/^./, (x) => x.toUpperCase())}
            </button>
          ))}
        </div>

        {s.flags.evening && !eveningDone && (
          <button type="button" onClick={() => openCapture({ type: 'note', evening: true, title: 'Best part of the day' })} style={{ padding: 16, borderRadius: 16, background: '#2E2614', border: '1px solid #4A3D1C', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', color: '#FFF3D6' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '.06em' }}>EVENING CHECK-IN · +5 XP</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>What was the best part of today?</span>
            <span style={{ fontSize: 12, color: '#E0C68E' }}>Tap to write it down</span>
          </button>
        )}

        {!groups.length && <span style={{ fontSize: 13, color: C.dim, textAlign: 'center', padding: 16 }}>{q || chip !== 'All' ? 'No notes match.' : 'No notes yet. Tap the pencil to write one.'}</span>}
        {groups.map((g) => (
          <div key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '.06em', padding: '0 4px' }}>{g.label}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {g.notes.map((n) => {
                const wide = n.links.length > 0 || n.body.length > 70;
                return (
                  <button key={n.id} type="button" onClick={() => setOpen(n.id)} style={{ gridColumn: wide ? 'span 2' : undefined, padding: 14, borderRadius: 14, background: C.surface, border: '1px solid #22262F', display: 'flex', flexDirection: 'column', gap: 6, color: C.text, textAlign: 'left' }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '.05em' }}>
                      <span style={{ color: allTagColor(s, n.tag) }}>{kindLabel(n.tag)}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: n.source === 'voice' ? C.accent : C.dim, fontWeight: n.source === 'voice' ? 600 : 500 }}>
                        {n.source === 'voice' && <Svg d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M5 11a7 7 0 0 0 14 0" size={11} sw={2.6} />}
                        {fmtTime(timeOfDayFromIso(n.createdAt, tz), s.time)}
                      </span>
                    </span>
                    <span style={{ fontSize: wide ? 15 : 14, fontWeight: 600 }}>{n.title}</span>
                    <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</span>
                    {n.links[0] && <span style={{ alignSelf: 'flex-start', marginTop: 4, padding: '5px 10px', borderRadius: 8, background: '#1F2A3D', color: '#B9D5FF', fontSize: 12 }}>Linked {n.links[0].type.toLowerCase()} · {n.links[0].label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {moreNotes && (
            <button type="button" onClick={() => void loadOlder('notes')} style={{ padding: 12, minHeight: 44, borderRadius: 12, border: `1px dashed ${C.border2}`, background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600 }}>
              Load older notes
            </button>
          )}
      </div>

      <button type="button" aria-label="New note" onClick={() => openCapture({ type: 'note' })} style={{ position: 'fixed', right: 20, bottom: 'calc(104px + env(safe-area-inset-bottom))', width: 56, height: 56, borderRadius: 18, border: 'none', background: C.amber, color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(255,200,92,.3)', zIndex: 15 }}>
        <Svg d={ICON.pencil} size={22} sw={2.4} />
      </button>

      {cur && <NoteSheet title={cur.title} onClose={() => setOpen(null)}>
        <NoteDetail note={cur} compact onDeleted={() => setOpen(null)} />
      </NoteSheet>}
    </div>
  );
}

/** Full-screen note view: Esc or Back closes it (Esc first cancels an edit in progress). */
function NoteSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.getElementById('edtitle') || document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} style={{ outline: 'none', position: 'fixed', inset: 0, zIndex: 50, background: C.bg, overflowY: 'auto', padding: '16px 20px max(32px, env(safe-area-inset-bottom))' }}>
      <button type="button" onClick={onClose} aria-label="Back to notes" style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: C.surface, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Svg d={ICON.back} sw={2.4} />
      </button>
      {children}
    </div>
  );
}
