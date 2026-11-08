'use client';
import { useEffect, useState } from 'react';
import type { Note } from '@/lib/types';
import { allTagColor, kindLabel, noteWhen } from '@/lib/view';
import { useApp } from './store';
import { C, HEAD, ICON, Svg } from './ui';

const typeColor = { Task: '#7FB2FF', Event: '#D59CFF' } as const;

export function NoteDetail({ note, onDeleted, compact }: { note: Note; onDeleted?: () => void; compact?: boolean }) {
  const { state, today, tz, act, openCapture, flash } = useApp();
  const s = state.settings;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [picker, setPicker] = useState(false);

  useEffect(() => { setEditing(false); setPicker(false); }, [note.id]);

  const startEdit = () => { setTitle(note.title); setBody(note.body); setEditing(true); setPicker(false); };
  const save = async () => {
    const r = await act('PATCH', `/api/notes/${note.id}`, { title, body, reclassify: true });
    if (r) setEditing(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if (editing) {
        if (e.key === 'Escape') setEditing(false);
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
      } else if (!typing && !compact && e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey && s.keys[2] !== 'E' && !document.querySelector('[aria-modal="true"]')) {
        e.preventDefault();
        startEdit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, title, body, note.id]);

  const linked = new Set(note.links.map((l) => l.label));
  const options = [
    ...state.tasks.filter((t) => !t.done).map((t) => ({ type: 'Task' as const, label: t.title, id: t.id })),
    ...state.events.filter((e) => e.date >= today).map((e) => ({ type: 'Event' as const, label: e.title, id: e.id }))
  ].filter((o) => !linked.has(o.label)).slice(0, 30);

  const color = allTagColor(s, note.tag);
  const btn = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600, minHeight: 44 } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ padding: '5px 10px', borderRadius: 99, background: C.surface2, color, fontSize: 12, fontWeight: 700 }}>{kindLabel(note.tag)}</span>
          <span style={{ fontSize: 13, color: C.dim }}>{noteWhen(note, today, tz, s.time)}{note.tag ? ` · ${note.tag.slice(1)}` : ''}</span>
          {note.source === 'voice' && (
            <span style={{ fontSize: 12, color: C.muted, padding: '4px 10px', borderRadius: 99, border: `1px solid ${C.border2}` }}>
              From voice{state.aiEngine === 'gemini' ? ` · sorted by ${s.sortModel}` : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!editing && (
            <button type="button" onClick={startEdit} style={{ ...btn, border: '1px solid #5A6273', background: '#1C2029', color: '#fff' }}>
              <Svg d={ICON.pencil} size={16} sw={2.2} color={C.amber} />Edit{compact ? '' : ' · E'}
            </button>
          )}
          <button type="button" onClick={() => act('PATCH', `/api/notes/${note.id}`, { toTask: true })} style={btn}>
            <Svg d={ICON.tasks.split('M20')[0]} size={16} sw={2.2} color={C.blue} />Turn into task
          </button>
          <button type="button" onClick={() => openCapture({ type: 'event', title: note.title, linkNoteId: note.id })} style={btn}>
            <Svg d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18" size={16} sw={2.2} color={C.purple} />Add to calendar
          </button>
          <button
            type="button" aria-label="Delete note"
            onClick={async () => { if (confirm('Delete this note?')) { if (await act('DELETE', `/api/notes/${note.id}`)) { flash('Note deleted'); onDeleted?.(); } } }}
            style={{ ...btn, padding: '10px 12px', color: '#FF9E92', borderColor: '#5C2A24' }}
          >
            <Svg d={ICON.trash} size={16} />
          </button>
        </div>
      </div>

      {!editing ? (
        <>
          <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: compact ? 28 : 34, lineHeight: 1.2 }}>{note.title}</h2>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.75, color: '#D4D9E2', maxWidth: 680, whiteSpace: 'pre-line' }}>{note.body}</p>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
          <label htmlFor="edtitle" style={{ position: 'absolute', left: -9999 }}>Title</label>
          <input id="edtitle" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus style={{ padding: '10px 14px', borderRadius: 12, background: '#14171D', border: '1px solid #5A6273', color: '#fff', fontFamily: HEAD, fontSize: 30, fontWeight: 700, outline: 'none', minWidth: 0 }} />
          <label htmlFor="edbody" style={{ position: 'absolute', left: -9999 }}>Note</label>
          <textarea id="edbody" value={body} onChange={(e) => setBody(e.target.value)} rows={8} style={{ padding: 14, borderRadius: 12, background: '#14171D', border: '1px solid #5A6273', color: C.text, fontFamily: 'inherit', fontSize: 16, lineHeight: 1.7, resize: 'vertical', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={save} style={{ padding: '11px 18px', borderRadius: 10, border: 'none', background: C.accent, color: 'var(--bg)', fontSize: 14, fontWeight: 700 }}>Save{compact ? '' : ' · Ctrl + Enter'}</button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: '11px 18px', borderRadius: 10, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600 }}>Cancel{compact ? '' : ' · Esc'}</button>
            <span style={{ fontSize: 12, color: C.dim }}>Saving re-sorts the tag{state.aiEngine === 'gemini' ? ` with ${s.sortModel}` : ''}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 }}>
        <span style={{ fontSize: 12, color: C.dim, letterSpacing: '.06em' }}>LINKED</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {note.links.map((l, i) => (
            <span key={`${l.label}${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 12px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontSize: 13, color: '#C3C9D4' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: typeColor[l.type] }} />
              <span style={{ color: typeColor[l.type], fontWeight: 600 }}>{l.type}</span>
              {l.label}
              <button type="button" aria-label={`Unlink ${l.label}`} onClick={() => act('PATCH', `/api/notes/${note.id}`, { links: note.links.filter((_, j) => j !== i) })} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Svg d={ICON.close} size={12} sw={2.6} />
              </button>
            </span>
          ))}
          <button type="button" onClick={() => setPicker((v) => !v)} aria-expanded={picker} aria-label="Link a task or event" style={{ width: 38, height: 38, borderRadius: 10, border: `1px dashed ${picker ? C.accent : '#4A5160'}`, background: picker ? C.accentDim : 'transparent', color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Svg d={ICON.plus} size={16} sw={2.6} />
          </button>
        </div>
        {picker && (
          <div role="listbox" aria-label="Link a task or event" style={{ width: 360, maxWidth: '100%', padding: 8, borderRadius: 14, background: '#1C2029', border: '1px solid #3A404D', boxShadow: '0 16px 40px rgba(0,0,0,.45)', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto' }}>
            <span style={{ padding: '6px 10px 8px', fontSize: 11, color: C.dim, letterSpacing: '.06em' }}>LINK A TASK OR EVENT</span>
            {options.map((o) => (
              <button key={o.type + o.id} type="button" role="option" aria-selected="false" onClick={async () => { await act('PATCH', `/api/notes/${note.id}`, { links: [...note.links, o] }); setPicker(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 9, border: 'none', background: 'transparent', color: C.text, fontSize: 13, textAlign: 'left', minHeight: 40 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: typeColor[o.type], flex: 'none' }} />
                <span style={{ flex: 1 }}>{o.label}</span>
                <span style={{ fontSize: 11, color: typeColor[o.type], fontWeight: 600 }}>{o.type}</span>
              </button>
            ))}
            {!options.length && <span style={{ padding: 10, fontSize: 13, color: C.dim }}>Everything’s already linked</span>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: C.dim }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: C.accent }} />
        Saved · this note earned <strong style={{ color: C.accent }}>+5 XP</strong>
      </div>
    </div>
  );
}
