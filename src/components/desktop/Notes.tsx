'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { NoteDetail } from '../NoteDetail';
import { DesktopNav } from '../Nav';
import { useApp } from '../store';
import { C, HEAD, ICON, Svg } from '../ui';
import { allTagColor, kindLabel, noteWhen } from '@/lib/view';

export default function Notes() {
  const { state, today, tz, openCapture, allNotes, moreNotes, loadOlder } = useApp();
  const s = state.settings;
  const [sel, setSel] = useState<number | null>(null);
  const [book, setBook] = useState('All notes');
  const [q, setQ] = useState('');

  const params = useSearchParams();
  useEffect(() => {
    const id = Number(params.get('note'));
    if (id) { setSel(id); setBook('All notes'); setQ(''); }
  }, [params]);

  const books = useMemo(
    () => [
      { label: 'All notes', tag: null as string | null, dot: C.accent },
      ...s.noteTags.map(([tag, color]) => ({ label: tag.slice(1).replace(/^./, (c) => c.toUpperCase()), tag, dot: color }))
    ],
    [s.noteTags]
  );
  const activeBook = books.find((b) => b.label === book) ?? books[0];
  const list = allNotes.filter((n) => (!activeBook.tag || n.tag === activeBook.tag) && (!q.trim() || (n.title + ' ' + n.body).toLowerCase().includes(q.trim().toLowerCase())));
  const cur = allNotes.find((n) => n.id === sel) ?? list[0] ?? null;
  const eveningDone = allNotes.some((n) => n.source === 'evening' && new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(n.createdAt)) === today);

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, display: 'flex', flexWrap: 'wrap' }}>
      <DesktopNav active="Notes">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, color: C.dim, letterSpacing: '.06em', padding: '0 12px 6px' }}>NOTEBOOKS</span>
          {books.map((b) => {
            const on = b.label === activeBook.label;
            const count = b.tag ? allNotes.filter((n) => n.tag === b.tag).length : allNotes.length;
            return (
              <button key={b.label} type="button" onClick={() => setBook(b.label)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: 'none', background: on ? '#1C2029' : 'transparent', color: on ? '#fff' : C.muted, fontSize: 13, textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: b.dot }} />
                {b.label}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: C.dim }}>{count}</span>
              </button>
            );
          })}
        </div>
      </DesktopNav>

      <section aria-label="Note list" style={{ flex: '1 1 340px', maxWidth: '100%', padding: '28px 20px', borderRight: '1px solid #1F232C', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 28 }}>Notes</h1>
          <button type="button" onClick={() => openCapture({ type: 'note' })} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: C.accent, color: 'var(--bg)', fontWeight: 700, fontSize: 13 }}>+ Note · {s.keys[1]}</button>
        </div>
        <label htmlFor="notesearch" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderRadius: 12, background: C.surface, border: `1px solid ${C.border2}` }}>
          <Svg d={ICON.search} size={16} sw={2.2} color={C.dim} />
          <input id="notesearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, ideas, voice logs" style={{ flex: 1, minWidth: 0, padding: '12px 0', background: 'transparent', border: 'none', color: '#fff', fontSize: 14, outline: 'none' }} />
        </label>

        {s.flags.evening && !eveningDone && (
          <button type="button" onClick={() => openCapture({ type: 'note', evening: true, title: 'Best part of the day' })} style={{ padding: 16, borderRadius: 14, background: '#2E2614', border: '1px solid #4A3D1C', display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', color: '#FFF3D6' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '.06em' }}>EVENING CHECK-IN</span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>What was the best part of today?</span>
            <span style={{ fontSize: 12, color: '#E0C68E' }}>One line is enough · +5 XP · keeps your streak</span>
          </button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!list.length && <span style={{ fontSize: 13, color: C.dim, padding: 6 }}>{q ? 'No notes match that search.' : 'No notes here yet.'}</span>}
          {list.map((n) => {
            const on = cur?.id === n.id;
            return (
              <button key={n.id} type="button" onClick={() => setSel(n.id)} aria-pressed={on} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 12, border: `1px solid ${on ? '#5A6273' : '#22262F'}`, background: on ? '#1C2029' : C.surface, color: C.text, textAlign: 'left' }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.05em' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: allTagColor(s, n.tag) }}>{kindLabel(n.tag)}</span>
                    {n.source === 'voice' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: C.accent, fontWeight: 600 }}>
                        <Svg d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M5 11a7 7 0 0 0 14 0" size={11} sw={2.6} />VOICE
                      </span>
                    )}
                  </span>
                  <span style={{ color: C.dim, fontWeight: 500 }}>{noteWhen(n, today, tz, s.time)}</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</span>
                <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</span>
              </button>
            );
          })}
          {moreNotes && (
            <button type="button" onClick={() => void loadOlder('notes')} style={{ padding: 12, minHeight: 44, borderRadius: 12, border: `1px dashed ${C.border2}`, background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 600 }}>
              Load older notes
            </button>
          )}
        </div>
      </section>

      <main style={{ flex: '999 1 480px', minWidth: 0, padding: '28px 48px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {cur ? (
          <div key={cur.id} data-anim="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}><NoteDetail note={cur} onDeleted={() => setSel(null)} /></div>
        ) : (
          <div style={{ margin: 'auto', textAlign: 'center', color: C.dim, fontSize: 14 }}>Select a note, or press {s.keys[1]} to write a new one.</div>
        )}
      </main>
    </div>
  );
}
