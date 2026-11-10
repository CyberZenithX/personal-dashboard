'use client';
import { useEffect, useRef, useState } from 'react';
import { useNav } from './motion';
import type { Note, NoteLink } from '@/lib/types';
import { allTagColor, kindLabel, noteWhen } from '@/lib/view';
import { useApp } from './store';
import { C, HEAD, ICON, Pill, Svg } from './ui';

const typeColor = { Task: '#7FB2FF', Event: '#D59CFF' } as const;

export function NoteDetail({ note, onDeleted, compact }: { note: Note; onDeleted?: () => void; compact?: boolean }) {
  const { state, today, tz, act, openCapture, flash, allTasks } = useApp();
  const router = useNav();
  const s = state.settings;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [picker, setPicker] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  /** 'auto' = let the sorter pick; null = untagged; otherwise the chosen tag */
  const [tagChoice, setTagChoice] = useState<string | null>(note.tag);

  useEffect(() => { setEditing(false); setPicker(false); setTagOpen(false); }, [note.id]);
  const pickerRef = useRef<HTMLDivElement>(null);
  // link picker / tag picker: Esc or a click outside closes them
  useEffect(() => {
    if (!picker && !tagOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setPicker(false); setTagOpen(false); } };
    const onDown = (e: MouseEvent) => { if (picker && pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicker(false); };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown); };
  }, [picker, tagOpen]);

  // The note-edit shortcut must not collide with a global one (E is "New event" by default).
  const editKey = s.keys.includes('E') ? 'Enter' : 'E';
  const tagChoices = [...s.noteTags.map((t) => t[0]), ...(note.tag && !s.noteTags.some((t) => t[0] === note.tag) ? [note.tag] : [])];

  const startEdit = () => { setTitle(note.title); setBody(note.body); setTagChoice(note.tag); setEditing(true); setPicker(false); setTagOpen(false); };
  const save = async () => {
    const r = await act('PATCH', `/api/notes/${note.id}`, tagChoice === 'auto' ? { title, body, reclassify: true } : { title, body, tag: tagChoice });
    if (r) setEditing(false);
  };
  const setTagNow = async (t: string | null | 'auto') => {
    setTagOpen(false);
    if (t === note.tag) return;
    const r = await act('PATCH', `/api/notes/${note.id}`, t === 'auto' ? { reclassify: true } : { tag: t });
    if (r) flash(t === 'auto' ? 'Tag re-sorted' : t ? `Tagged ${t}` : 'Tag removed');
  };
  const tagPills = (current: string | null | 'auto', pick: (t: string | null | 'auto') => void, withAuto: boolean) => (
    <div role="group" aria-label="Tag" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {withAuto && <Pill on={current === 'auto'} onClick={() => pick('auto')}>Auto-sort</Pill>}
      <Pill on={current === null} onClick={() => pick(null)}>Untagged</Pill>
      {tagChoices.map((t) => <Pill key={t} on={current === t} onClick={() => pick(t)} color={allTagColor(s, t)}>{t}</Pill>)}
    </div>
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if (editing) {
        if (e.key === 'Escape') setEditing(false);
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
      } else if (!compact && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !document.querySelector('[aria-modal="true"]')) {
        const t = e.target as HTMLElement | null;
        const interactive = typing || !!t?.closest?.('button, a, [role="button"], [role="option"], [contenteditable="true"]');
        const hit = editKey === 'Enter' ? e.key === 'Enter' : e.key.toLowerCase() === 'e';
        if (hit && !interactive) {
          e.preventDefault();
          startEdit();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, title, body, tagChoice, note.id, editKey]);

  // Links point at a task/event id; show its current name (it may have been renamed since).
  const resolve = (l: NoteLink) => {
    if (l.type === 'Task') {
      const t = l.id ? allTasks.find((x) => x.id === l.id) : allTasks.find((x) => x.title === l.label); // old links had no id
      return { label: t?.title ?? l.label, exists: !!t, go: t ? `/tasks?task=${t.id}` : null };
    }
    const e = l.id ? state.events.find((x) => x.id === l.id) : state.events.find((x) => x.title === l.label);
    return { label: e?.title ?? l.label, exists: !!e, go: e ? `/calendar?date=${e.date >= today || !e.repeatDays?.length ? e.date : today}` : null };
  };
  const linkedKeys = new Set(note.links.map((l) => `${l.type}:${l.id ?? l.label}`));
  const options = [
    ...state.tasks.filter((t) => !t.done).map((t) => ({ type: 'Task' as const, label: t.title, id: t.id })),
    ...state.events.filter((e) => e.date >= today || e.repeatDays?.length).map((e) => ({ type: 'Event' as const, label: e.title, id: e.id }))
  ].filter((o) => !linkedKeys.has(`${o.type}:${o.id}`)).slice(0, 30);
  const ownTask = note.links.map((l) => (l.type === 'Task' && l.id ? allTasks.find((t) => t.id === l.id) : undefined)).find(Boolean);
  const [making, setMaking] = useState(false);

  const color = allTagColor(s, note.tag);
  const btn = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600, minHeight: 44 } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button" onClick={() => setTagOpen((v) => !v)} aria-expanded={tagOpen} aria-label={`Tag: ${note.tag ?? 'untagged'}. Change tag`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', minHeight: 32, borderRadius: 99, border: `1px solid ${tagOpen ? C.accent : 'transparent'}`, background: C.surface2, color, fontSize: 12, fontWeight: 700 }}
          >
            {kindLabel(note.tag)}<Svg d="M6 9l6 6 6-6" size={12} sw={2.6} />
          </button>
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
              <Svg d={ICON.pencil} size={16} sw={2.2} color={C.amber} />Edit{compact ? '' : ` · ${editKey}`}
            </button>
          )}
          {ownTask ? (
            <button type="button" onClick={() => router.push(`/tasks?task=${ownTask.id}`)} style={btn} title={ownTask.title}>
              <Svg d={ICON.tasks.split('M20')[0]} size={16} sw={2.2} color={C.blue} />Open its task
            </button>
          ) : (
            <button type="button" disabled={making} onClick={async () => { setMaking(true); await act('PATCH', `/api/notes/${note.id}`, { toTask: true }); setMaking(false); }} style={{ ...btn, opacity: making ? 0.6 : 1 }}>
              <Svg d={ICON.tasks.split('M20')[0]} size={16} sw={2.2} color={C.blue} />{making ? 'Creating…' : 'Turn into task'}
            </button>
          )}
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

      {tagOpen && !editing && (
        <div data-anim="pop" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 14, background: C.surface, border: `1px solid ${C.border2}`, maxWidth: 680 }}>
          <span style={{ fontSize: 12, color: C.dim }}>Change tag</span>
          {tagPills(note.tag, setTagNow, true)}
        </div>
      )}

      {!editing ? (
        <>
          <h2 onDoubleClick={startEdit} style={{ margin: 0, fontFamily: HEAD, fontSize: compact ? 28 : 34, lineHeight: 1.2 }}>{note.title}</h2>
          <p onDoubleClick={startEdit} style={{ margin: 0, fontSize: 16, lineHeight: 1.75, color: '#D4D9E2', maxWidth: 680, whiteSpace: 'pre-line' }}>{note.body}</p>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
          <label htmlFor="edtitle" style={{ position: 'absolute', left: -9999 }}>Title</label>
          <input id="edtitle" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus style={{ padding: '10px 14px', borderRadius: 12, background: '#14171D', border: '1px solid #5A6273', color: '#fff', fontFamily: HEAD, fontSize: 30, fontWeight: 700, outline: 'none', minWidth: 0 }} />
          <label htmlFor="edbody" style={{ position: 'absolute', left: -9999 }}>Note</label>
          <textarea id="edbody" value={body} onChange={(e) => setBody(e.target.value)} rows={8} style={{ padding: 14, borderRadius: 12, background: '#14171D', border: '1px solid #5A6273', color: C.text, fontFamily: 'inherit', fontSize: 16, lineHeight: 1.7, resize: 'vertical', outline: 'none' }} />
          <span style={{ fontSize: 12, color: C.dim }}>Tag</span>
          {tagPills(tagChoice, setTagChoice, true)}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={save} style={{ padding: '11px 18px', borderRadius: 10, border: 'none', background: C.accent, color: 'var(--bg)', fontSize: 14, fontWeight: 700 }}>Save{compact ? '' : ' · Ctrl + Enter'}</button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: '11px 18px', borderRadius: 10, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600 }}>Cancel{compact ? '' : ' · Esc'}</button>
            {tagChoice === 'auto' && <span style={{ fontSize: 12, color: C.dim }}>Saving re-sorts the tag{state.aiEngine === 'gemini' ? ` with ${s.sortModel}` : ''}</span>}
          </div>
        </div>
      )}

      <div ref={pickerRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 680 }}>
        <span style={{ fontSize: 12, color: C.dim, letterSpacing: '.06em' }}>LINKED</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {note.links.map((l, i) => {
            const r = resolve(l);
            return (
            <span key={`${l.type}${l.id ?? l.label}${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 4px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontSize: 13, color: '#C3C9D4' }}>
              <button
                type="button" disabled={!r.go} onClick={() => r.go && router.push(r.go)} title={r.go ? `Open ${l.type.toLowerCase()}` : 'No longer exists'}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 8px', minHeight: 28, border: 'none', background: 'transparent', color: r.exists ? '#C3C9D4' : C.dim, fontSize: 13, textDecoration: r.exists ? 'none' : 'line-through', cursor: r.go ? 'pointer' : 'default' }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: typeColor[l.type] }} />
                <span style={{ color: typeColor[l.type], fontWeight: 600 }}>{l.type}</span>
                {r.label}
              </button>
              <button type="button" aria-label={`Unlink ${r.label}`} onClick={() => act('PATCH', `/api/notes/${note.id}`, { links: note.links.filter((_, j) => j !== i) })} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Svg d={ICON.close} size={12} sw={2.6} />
              </button>
            </span>
            );
          })}
          <button type="button" onClick={() => setPicker((v) => !v)} aria-expanded={picker} aria-label="Link a task or event" style={{ width: 38, height: 38, borderRadius: 10, border: `1px dashed ${picker ? C.accent : '#4A5160'}`, background: picker ? C.accentDim : 'transparent', color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Svg d={ICON.plus} size={16} sw={2.6} />
          </button>
        </div>
        {picker && (
          <div role="listbox" aria-label="Link a task or event" data-anim="pop" style={{ width: 360, maxWidth: '100%', padding: 8, borderRadius: 14, background: '#1C2029', border: '1px solid #3A404D', boxShadow: '0 16px 40px rgba(0,0,0,.45)', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto' }}>
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
        {editing ? (
          <>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: C.amber }} />
            Unsaved changes · {compact ? 'tap Save to keep them' : 'Ctrl + Enter to save, Esc to cancel'}
          </>
        ) : (
          <>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: C.accent }} />
            Saved · this note earned <strong style={{ color: C.accent }}>+5 XP</strong>
          </>
        )}
      </div>
    </div>
  );
}
