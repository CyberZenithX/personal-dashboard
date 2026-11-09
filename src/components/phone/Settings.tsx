'use client';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Modal } from '../CaptureSheet';
import { DataActions, PromptPreview, ShortcutsEditor, TagGroup } from '../settingsParts';
import { useApp } from '../store';
import { C, HEAD, ICON, Svg, Toggle } from '../ui';
import { LISTEN_MODELS, SORT_MODELS, THEMES } from '@/lib/settings';
import type { Settings } from '@/lib/types';

const I = {
  hash: 'M5 9h14M5 15h14M10 3L8 21M16 3l-2 18',
  key: 'M3 7h18v10H3zM7 11h1M11 11h1M15 11h1M8 14h8',
  sound: 'M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  bell: 'M6 9a6 6 0 0 1 12 0c0 6 3 7 3 7H3s3-1 3-7M10 20a2 2 0 0 0 4 0',
  moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10'
};

interface Row {
  label: string; icon: string; color: string; sub?: string; value?: string;
  sw?: { on: boolean; flip: () => void };
  sheet?: string; href?: string; soon?: boolean; action?: () => void;
}

export default function PhoneSettings() {
  const { state, setSettings, saveState } = useApp();
  const router = useRouter();
  const s = state.settings;
  const level = state.progress.level;
  const [sheet, setSheet] = useState<string | null>(null);
  const flag = (k: keyof Settings['flags']) => ({ on: s.flags[k], flip: () => setSettings({ flags: { [k]: !s.flags[k] } }) });
  const page = (k: 'Tasks' | 'Notes' | 'Calendar') => ({ on: s.pages[k], flip: () => setSettings({ pages: { [k]: !s.pages[k] } }) });

  const groups: { title: string; rows: Row[] }[] = [
    { title: 'Pages', rows: [
      { label: 'Tasks', icon: ICON.tasks, color: C.blue, sw: page('Tasks') },
      { label: 'Notes', icon: ICON.notes, color: C.amber, sw: page('Notes') },
      { label: 'Calendar', icon: ICON.calendar, color: C.purple, sw: page('Calendar') }] },
    { title: 'Hashtags', rows: [
      { label: 'Task hashtags', icon: I.hash, color: C.blue, sub: s.taskTags.map((t) => t[0]).join(' '), value: String(s.taskTags.length), sheet: 'taskTags' },
      { label: 'Note hashtags', icon: I.hash, color: C.amber, sub: s.noteTags.map((t) => t[0]).join(' '), value: String(s.noteTags.length), sheet: 'noteTags' }] },
    { title: 'Shortcuts', rows: [
      { label: 'Keyboard shortcuts', icon: I.key, color: C.muted, value: String(s.keys.length), sheet: 'keys' },
      { label: 'Talk to log', icon: ICON.mic, color: C.accent, sub: 'Tap the mic on Today or in the tab bar', value: '' }] },
    { title: 'Voice and AI', rows: [
      { label: 'Listening model', icon: ICON.mic, color: C.accent, value: s.listenModel.replace('Gemini ', ''), sheet: 'listen' },
      { label: 'Sorting model', icon: ICON.bolt, color: C.accent, value: s.sortModel.replace('Gemini ', ''), sheet: 'sort' },
      { label: 'Save sorted items straight away', icon: I.box, color: '#5EE0C1', sw: flag('autoSave') },
      { label: 'Sorting prompt', icon: ICON.notes, color: C.muted, sheet: 'prompt', value: '' }] },
    { title: 'Rewards and streaks', rows: [
      { label: 'Daily check-in goal', icon: ICON.flame, color: C.orange, value: String(s.goal), sheet: 'goal' },
      { label: 'Sounds', icon: I.sound, color: C.orange, sw: flag('sounds') },
      { label: 'Celebrations', icon: ICON.star, color: C.purple, sw: flag('confetti') }] },
    { title: 'Look', rows: [
      { label: 'Theme', icon: I.moon, color: C.accent, value: s.theme, sheet: 'theme' },
      { label: 'Density', icon: I.eye, color: C.muted, value: s.density, sheet: 'density' },
      { label: 'Week starts on', icon: ICON.calendar, color: C.muted, value: s.week, sheet: 'week' },
      { label: 'Time format', icon: ICON.today, color: C.muted, value: s.time, sheet: 'time' }] },
    { title: 'Reminders', rows: [
      { label: 'Check-in nudges', icon: I.bell, color: C.coral, sub: 'After 4 hours with no log', sw: flag('nudges') },
      { label: 'Evening check-in', icon: I.bell, color: C.coral, sw: flag('evening'), sub: s.eveningTime, sheet: 'evening' }] },
    { title: 'Data', rows: [
      { label: 'Export, import and reset', icon: I.box, color: C.muted, sheet: 'data', value: '' },
      { label: 'Connect Google Calendar', icon: ICON.calendar, color: C.muted, soon: true }] },
    { title: 'Account', rows: [
      { label: 'Lock Daylog (log out)', icon: ICON.close, color: C.muted, action: async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; } }] }
  ];

  const opt = (label: string, on: boolean, pick: () => void, disabled?: boolean, note?: string) => (
    <button key={label} type="button" disabled={disabled} onClick={pick} aria-pressed={on} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 12, border: `1px solid ${on ? C.accent : C.border2}`, background: on ? C.accentDim : 'transparent', color: on ? C.accent : C.text, fontSize: 15, fontWeight: 600, minHeight: 52, opacity: disabled ? 0.5 : 1, textAlign: 'left' }}>
      {label}<span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{note}</span>
    </button>
  );

  let body: ReactNode = null;
  let title = '';
  switch (sheet) {
    case 'taskTags': title = 'Task hashtags'; body = <TagGroup kind="taskTags" title="Gemini can only pick from these" />; break;
    case 'noteTags': title = 'Note hashtags'; body = <TagGroup kind="noteTags" title="Gemini can only pick from these" />; break;
    case 'keys': title = 'Keyboard shortcuts'; body = <div style={{ display: 'flex', flexDirection: 'column' }}><ShortcutsEditor /></div>; break;
    case 'listen': title = 'Listening model'; body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{LISTEN_MODELS.map((m) => opt(m, s.listenModel === m, () => setSettings({ listenModel: m })))}</div>; break;
    case 'sort': title = 'Sorting model'; body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{SORT_MODELS.map((m) => opt(m, s.sortModel === m, () => setSettings({ sortModel: m })))}</div>; break;
    case 'prompt': title = 'Sorting prompt'; body = <PromptPreview />; break;
    case 'goal': title = 'Daily check-in goal';
      body = (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <button type="button" aria-label="Fewer check-ins" onClick={() => setSettings({ goal: Math.max(1, s.goal - 1) })} style={{ width: 56, height: 56, borderRadius: 16, border: 'none', background: C.surface2, color: C.text, fontSize: 24 }}>−</button>
          <span style={{ width: 60, textAlign: 'center', fontFamily: HEAD, fontSize: 40, fontWeight: 700 }}>{s.goal}</span>
          <button type="button" aria-label="More check-ins" onClick={() => setSettings({ goal: Math.min(12, s.goal + 1) })} style={{ width: 56, height: 56, borderRadius: 16, border: 'none', background: C.surface2, color: C.text, fontSize: 24 }}>+</button>
        </div>
      ); break;
    case 'theme': title = 'Theme'; body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{THEMES.map((t) => opt(t.name, s.theme === t.name, () => setSettings({ theme: t.name }), level < t.lockLvl, level < t.lockLvl ? `Unlocks at Lv ${t.lockLvl}` : ''))}</div>; break;
    case 'density': title = 'Density'; body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{(['Comfortable', 'Compact'] as const).map((o) => opt(o, s.density === o, () => setSettings({ density: o })))}</div>; break;
    case 'week': title = 'Week starts on'; body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{(['Mon', 'Sun'] as const).map((o) => opt(o, s.week === o, () => setSettings({ week: o })))}</div>; break;
    case 'time': title = 'Time format'; body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{(['24h', '12h'] as const).map((o) => opt(o, s.time === o, () => setSettings({ time: o })))}</div>; break;
    case 'evening': title = 'Evening check-in time';
      body = <input type="time" aria-label="Evening check-in time" value={s.eveningTime} onChange={(e) => e.target.value && setSettings({ eveningTime: e.target.value })} style={{ padding: 14, borderRadius: 12, background: C.bg, border: '1px solid #3A404D', color: '#fff', fontSize: 18, colorScheme: 'dark' }} />; break;
    case 'data': title = 'Data'; body = <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><DataActions phone /></div>; break;
  }

  const rowBtnStyle = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', minHeight: 56, border: 'none', background: 'transparent', color: C.text, textAlign: 'left' as const };

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: '100dvh' }}>
      <div style={{ padding: 'max(20px, env(safe-area-inset-top)) 20px 48px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => router.back()} aria-label="Back" style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text }}>
            <Svg d={ICON.back} sw={2.4} />
          </button>
          <h1 style={{ margin: 0, flex: 1, fontFamily: HEAD, fontSize: 24 }}>Settings</h1>
          <span role="status" style={{ fontSize: 12, color: saveState === 'saving' ? C.amber : C.accent }}>{saveState === 'saving' ? 'Saving…' : 'Saved'}</span>
        </div>

        {groups.map((g) => (
          <section key={g.title} aria-label={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 style={{ margin: 0, padding: '0 4px', fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>{g.title}</h2>
            <div style={{ borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              {g.rows.map((r, i) => {
                const inner = (
                  <>
                    <span style={{ width: 32, height: 32, borderRadius: 9, background: `color-mix(in srgb, ${r.color} 13%, transparent)`, color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Svg d={r.icon} size={16} sw={2.2} /></span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{r.label}</span>
                      {r.sub && <span style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</span>}
                    </span>
                    {r.soon && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', padding: '3px 8px', borderRadius: 99, background: '#2A1D12', color: C.accent2 }}>COMING SOON</span>}
                    {!r.sw && !r.soon && r.value !== undefined && r.value !== '' && <span style={{ fontSize: 13, color: C.muted }}>{r.value}</span>}
                    {!r.sw && !r.soon && r.sheet && <Svg d={ICON.chevron} size={16} sw={2.4} color="#5A6273" />}
                  </>
                );
                const divider = { borderTop: i === 0 ? 'none' : '1px solid #22262F' };
                if (r.sw) {
                  return (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', ...divider }}>
                      {r.sheet ? (
                        <button type="button" onClick={() => setSheet(r.sheet as string)} style={{ ...rowBtnStyle, flex: 1, width: 'auto' }}>{inner}</button>
                      ) : (
                        <div style={{ ...rowBtnStyle, flex: 1, width: 'auto' }}>{inner}</div>
                      )}
                      <div style={{ padding: '0 16px 0 0' }}><Toggle small on={r.sw.on} onChange={r.sw.flip} label={r.label} /></div>
                    </div>
                  );
                }
                if (r.soon) return <div key={r.label} aria-disabled="true" style={{ ...rowBtnStyle, ...divider, opacity: 0.8 }}>{inner}</div>;
                return (
                  <button key={r.label} type="button" onClick={() => (r.action ? r.action() : r.sheet && setSheet(r.sheet))} style={{ ...rowBtnStyle, ...divider, cursor: r.sheet || r.action ? 'pointer' : 'default' }}>{inner}</button>
                );
              })}
            </div>
          </section>
        ))}
        <span style={{ textAlign: 'center', fontSize: 12, color: '#5A6273' }}>Daylog · free forever · your data, your Neon database</span>
      </div>

      {sheet && body && (
        <Modal label={title} onClose={() => setSheet(null)}>
          <h2 style={{ margin: 0, fontFamily: HEAD, fontSize: 18 }}>{title}</h2>
          {body}
          <button type="button" onClick={() => setSheet(null)} style={{ padding: 14, borderRadius: 14, border: 'none', background: C.accent, color: 'var(--bg)', fontSize: 15, fontWeight: 700 }}>Done</button>
        </Modal>
      )}
    </div>
  );
}
