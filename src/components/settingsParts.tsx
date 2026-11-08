'use client';
import { useRef, useState } from 'react';
import { Modal } from './CaptureSheet';
import { keyState, comboFromEvent } from './keys';
import { useApp } from './store';
import { C, HEAD, ICON, MONO, Svg, Toggle } from './ui';
import { buildPrompt, DEFAULT_KEYS, TAG_PALETTE } from '@/lib/settings';
import { ymd } from '@/lib/time';
import type { Prio, TagPair } from '@/lib/types';

export function ToggleRow({ label, desc, on, onChange, divider = true }: { label: string; desc?: string; on: boolean; onChange: () => void; divider?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: divider ? '1px solid #22262F' : 'none' }}>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
        {desc && <span style={{ fontSize: 13, color: C.dim }}>{desc}</span>}
      </span>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  );
}

export function TagGroup({ kind, title }: { kind: 'taskTags' | 'noteTags'; title: string }) {
  const { state, setSettings } = useApp();
  const tags = state.settings[kind];
  const [draft, setDraft] = useState('');
  const set = (next: TagPair[]) => setSettings({ [kind]: next });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    let v = draft.trim().toLowerCase().replace(/\s+/g, '');
    if (!v) return;
    if (v[0] !== '#') v = '#' + v;
    if (tags.some((t) => t[0] === v)) return;
    set([...tags, [v, TAG_PALETTE[tags.length % TAG_PALETTE.length]]]);
    setDraft('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 14, borderTop: '1px solid #22262F' }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {tags.map(([name, color], i) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 10px', borderRadius: 10, background: C.surface2, border: `1px solid ${C.border2}`, fontSize: 13, fontWeight: 600 }}>
            <button
              type="button" aria-label={`Change colour of ${name}`} title="Click to change colour"
              onClick={() => set(tags.map((t, j) => (j === i ? [t[0], TAG_PALETTE[(TAG_PALETTE.indexOf(color) + 1) % TAG_PALETTE.length]] : t)))}
              style={{ width: 16, height: 16, borderRadius: 99, border: '2px solid #0E1014', background: color, padding: 0, boxShadow: `0 0 0 1px ${color}` }}
            />
            <span style={{ color }}>{name}</span>
            <button type="button" aria-label={`Remove ${name}`} onClick={() => set(tags.filter((_, j) => j !== i))} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Svg d={ICON.close} size={12} sw={2.6} />
            </button>
          </span>
        ))}
        <form onSubmit={add} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label htmlFor={`new-${kind}`} style={{ position: 'absolute', left: -9999 }}>New tag for {title}</label>
          <input id={`new-${kind}`} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="#newtag" style={{ width: 120, padding: '9px 12px', borderRadius: 10, background: C.bg, border: '1px dashed #4A5160', color: '#fff', fontSize: 13, outline: 'none' }} />
          <button type="submit" style={{ padding: '9px 12px', borderRadius: 10, border: 'none', background: '#262B36', color: C.accent, fontSize: 13, fontWeight: 700 }}>Add</button>
        </form>
      </div>
    </div>
  );
}

export function ShortcutsEditor() {
  const { state, setSettings } = useApp();
  const keys = state.settings.keys;
  const [rec, setRec] = useState(-1);
  const stop = () => { keyState.recording = false; setRec(-1); };
  return (
    <>
      {DEFAULT_KEYS.map(([action], i) => {
        const on = rec === i;
        return (
          <div key={action} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid #22262F' }}>
            <span style={{ flex: 1, fontSize: 14 }}>{action}</span>
            <span style={{ minWidth: 90, textAlign: 'center', padding: '7px 12px', borderRadius: 8, background: on ? C.accentDim : C.bg, border: `1px solid ${on ? C.accent : '#3A404D'}`, color: on ? C.accent : '#fff', fontFamily: MONO, fontSize: 13 }}>
              {on ? 'Press a key…' : keys[i]}
            </span>
            <button
              type="button" style={{ width: 86, padding: '8px 0', borderRadius: 9, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text, fontSize: 13, fontWeight: 600 }}
              onClick={() => { keyState.recording = !on; setRec(on ? -1 : i); }}
              onBlur={() => on && stop()}
              onKeyDown={(e) => {
                if (!on) return;
                e.preventDefault();
                if (e.key === 'Escape') return stop();
                const combo = comboFromEvent(e);
                if (!combo) return;
                setSettings({ keys: keys.map((k, j) => (j === i ? combo : k)) });
                stop();
              }}
            >
              {on ? 'Cancel' : 'Change'}
            </button>
          </div>
        );
      })}
      <button type="button" onClick={() => setSettings({ keys: DEFAULT_KEYS.map((k) => k[1]) })} style={{ alignSelf: 'flex-start', marginTop: 8, padding: '8px 12px', borderRadius: 9, border: 'none', background: 'transparent', color: C.muted, fontSize: 13, textDecoration: 'underline' }}>
        Reset to defaults
      </button>
    </>
  );
}

export function PromptPreview() {
  const { state } = useApp();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12, color: C.dim, letterSpacing: '.06em' }}>LIVE PROMPT PREVIEW</span>
      <pre style={{ margin: 0, padding: 16, borderRadius: 12, background: '#0B0C10', border: '1px solid #22262F', color: '#C3C9D4', fontFamily: MONO, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
        {buildPrompt(state.settings)}
      </pre>
    </div>
  );
}

/* ----------------------------------------------------------- data actions */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

interface ImportRow { title: string; dueDate?: string | null; dueTime?: string | null; prio?: Prio; tag?: string | null; done?: boolean }

export function parseImport(text: string, name: string, tz: string): ImportRow[] {
  const toDay = (v?: string) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : ymd(new Date(t), tz);
  };
  if (name.toLowerCase().endsWith('.json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    const json = JSON.parse(text);
    const arr: Record<string, unknown>[] = Array.isArray(json) ? json : json.tasks ?? [];
    return arr.map((t) => ({
      title: String(t.title ?? t.content ?? ''),
      dueDate: toDay(String(t.due_date ?? t.dueDate ?? t.due ?? '')),
      dueTime: (t.due_time as string) ?? (t.dueTime as string) ?? null,
      prio: (['high', 'med', 'low'].includes(String(t.prio)) ? t.prio : 'low') as Prio,
      tag: (t.tag as string) ?? null,
      done: !!t.done
    }));
  }
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iType = col('type'), iTitle = col('content', 'title', 'task', 'name'), iDate = col('date', 'due', 'due_date', 'due date');
  const iPrio = col('priority'), iTag = col('tag', 'label', 'labels'), iDone = col('done', 'completed');
  const todoist = iType >= 0 && head.includes('content');
  return rows.slice(1).flatMap((r) => {
    if (todoist && r[iType]?.trim().toLowerCase() !== 'task') return [];
    const title = (r[iTitle] ?? '').trim();
    if (!title) return [];
    const pr = Number(r[iPrio]);
    const prio: Prio = todoist ? (pr === 1 ? 'high' : pr === 2 || pr === 3 ? 'med' : 'low') : pr >= 3 ? 'high' : pr === 2 ? 'med' : 'low';
    return [{
      title, dueDate: toDay(r[iDate]), prio, tag: iTag >= 0 ? (r[iTag] || '').split(/[ ,]/)[0] || null : null,
      done: iDone >= 0 ? /^(1|true|yes|x)$/i.test(r[iDone] ?? '') : false
    }];
  });
}

export function DataActions(_props: { phone?: boolean }) {
  const { state, act, flash, tz } = useApp();
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const btn = { padding: '11px 16px', borderRadius: 10, border: '1px solid #3A404D', background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600, minHeight: 44 } as const;
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const rows = parseImport(await f.text(), f.name, tz);
      if (!rows.length) return flash('No tasks found in that file');
      const r = await act('POST', '/api/import', { tasks: rows });
      if (r) flash(`Imported ${(r.data?.imported as number) ?? rows.length} tasks`);
    } catch {
      flash("Couldn't read that file");
    }
    if (file.current) file.current.value = '';
  };
  void state;
  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href="/api/export" download style={{ ...btn, color: C.text, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>Export everything (JSON)</a>
        <button type="button" style={btn} onClick={() => file.current?.click()}>Import from Todoist / CSV</button>
        <input ref={file} type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button type="button" disabled aria-disabled="true" title="Google Calendar sync is coming soon" style={{ ...btn, color: C.dim, borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.85 }}>
          Connect Google Calendar
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', padding: '3px 8px', borderRadius: 99, background: '#2A1D12', color: C.accent2 }}>COMING SOON</span>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 12, border: '1px solid #5C2A24', background: '#1E1412', flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#FFB4A8' }}>Reset progress</span>
          <span style={{ fontSize: 13, color: '#C9A39C' }}>Clears XP, level and streaks. Tasks and notes stay.</span>
        </span>
        <button type="button" onClick={() => setConfirm(true)} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #FF7A6B', background: 'transparent', color: '#FF9E92', fontSize: 14, fontWeight: 600, minHeight: 44 }}>Reset…</button>
      </div>
      {confirm && (
        <Modal label="Reset progress" onClose={() => setConfirm(false)}>
          <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 20 }}>Reset all progress?</h2>
          <p style={{ margin: 0, fontSize: 14, color: C.muted, lineHeight: 1.5 }}>XP, level, streaks and quest history go back to zero. Your tasks, notes and events stay exactly as they are. This can’t be undone.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => setConfirm(false)} style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid #3A404D', background: 'transparent', color: C.text, fontSize: 15, fontWeight: 600 }}>Cancel</button>
            <button type="button" onClick={async () => { await act('POST', '/api/progress/reset'); setConfirm(false); flash('Progress reset'); }} style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: '#FF7A6B', color: '#1E1412', fontSize: 15, fontWeight: 700 }}>Reset progress</button>
          </div>
        </Modal>
      )}
    </>
  );
}
