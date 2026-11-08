'use client';
import type { CSSProperties, ReactNode } from 'react';
import { DataActions, PromptPreview, ShortcutsEditor, TagGroup, ToggleRow } from '../settingsParts';
import { DesktopNav } from '../Nav';
import { useApp } from '../store';
import { C, HEAD } from '../ui';
import { LISTEN_MODELS, SORT_MODELS, THEMES } from '@/lib/settings';
import type { Flags, Settings } from '@/lib/types';

const card: CSSProperties = { padding: 24, borderRadius: 18, background: C.surface, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6 };
const h2: CSSProperties = { margin: 0, fontFamily: HEAD, fontSize: 20 };
const sub: CSSProperties = { margin: 0, fontSize: 13, color: C.muted };
const select: CSSProperties = { padding: '11px 12px', borderRadius: 10, background: C.bg, border: '1px solid #3A404D', color: '#fff', fontSize: 14 };

function Section({ id, title, desc, children, gap = 6 }: { id: string; title: string; desc?: string; children: ReactNode; gap?: number }) {
  return (
    <section id={id} aria-labelledby={`h-${id}`} style={{ ...card, gap, scrollMarginTop: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: desc ? 4 : 0 }}>
        <h2 id={`h-${id}`} style={h2}>{title}</h2>
        {desc && <p style={sub}>{desc}</p>}
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { state, setSettings, saveState } = useApp();
  const s = state.settings;
  const level = state.progress.level;
  const flag = (k: keyof Flags, label: string, desc: string, divider = true) => (
    <ToggleRow key={k} label={label} desc={desc} on={s.flags[k]} divider={divider} onChange={() => setSettings({ flags: { [k]: !s.flags[k] } })} />
  );
  const seg = <K extends 'density' | 'week' | 'time'>(label: string, key: K, opts: Settings[K][]) => (
    <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 11, background: C.bg, border: `1px solid ${C.border2}` }}>
        {opts.map((o) => (
          <button key={String(o)} type="button" role="radio" aria-checked={s[key] === o} onClick={() => setSettings({ [key]: o } as Partial<Settings>)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: s[key] === o ? C.accent : 'transparent', color: s[key] === o ? 'var(--bg)' : C.muted, fontSize: 13, fontWeight: 600 }}>{String(o)}</button>
        ))}
      </div>
    </div>
  );
  const saving = saveState === 'saving';

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.text, display: 'flex', flexWrap: 'wrap', position: 'relative' }}>
      <DesktopNav active="Settings">
        <span style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, padding: '0 12px' }}>This menu updates live when you switch pages on or off below.</span>
      </DesktopNav>

      <main style={{ flex: '999 1 560px', minWidth: 0, padding: '32px 40px 64px', display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 980 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 34 }}>Settings</h1>
            <span style={{ fontSize: 14, color: C.muted }}>Every change saves on its own. No save button to hunt for.</span>
          </div>
          <span role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: saving ? C.amber : C.accent }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: saving ? C.amber : C.accent }} />
            {saving ? 'Saving…' : 'All changes saved'}
          </span>
        </header>

        <nav aria-label="Jump to section" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['Pages', '#pages'], ['Hashtags', '#tags'], ['Shortcuts', '#shortcuts'], ['Voice and AI', '#ai'], ['Rewards', '#rewards'], ['Look', '#look'], ['Reminders', '#reminders'], ['Data', '#data']].map(([l, h]) => (
            <a key={l} href={h} style={{ padding: '8px 14px', borderRadius: 99, border: `1px solid ${C.border2}`, background: '#14171D', color: '#C3C9D4', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>{l}</a>
          ))}
        </nav>

        <Section id="pages" title="1. Pages" desc="Pick which pages show in the menu. Today and Progress always stay on.">
          {([['Tasks', 'To-dos, quests and the quick-add bar'], ['Notes', 'Ideas, meetings, journal and voice notes'], ['Calendar', 'Week view with your events and time blocks']] as const).map(([p, d]) => (
            <ToggleRow key={p} label={p} desc={d} on={s.pages[p]} onChange={() => setSettings({ pages: { [p]: !s.pages[p] } })} />
          ))}
        </Section>

        <Section id="tags" title="2. Hashtags" desc="These are the only tags Gemini can pick from when it sorts what you type or say. Change them here and the classifier changes with them." gap={18}>
          <TagGroup kind="taskTags" title="Task hashtags" />
          <TagGroup kind="noteTags" title="Note hashtags" />
        </Section>

        <Section id="shortcuts" title="3. Shortcuts" desc="Click Change, then press the new key combo. Esc cancels.">
          <ShortcutsEditor />
        </Section>

        <Section id="ai" title="4. Voice and AI" desc="Which Gemini models listen and sort. The prompt below rebuilds itself from your hashtags." gap={14}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>Listening model
              <select value={s.listenModel} onChange={(e) => setSettings({ listenModel: e.target.value })} style={select}>{LISTEN_MODELS.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>Sorting model
              <select value={s.sortModel} onChange={(e) => setSettings({ sortModel: e.target.value })} style={select}>{SORT_MODELS.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
          </div>
          <p style={{ ...sub, color: C.dim }}>
            {state.aiEngine === 'gemini'
              ? 'Gemini sorting is on for this deployment.'
              : 'No Gemini key is set on this deployment, so Daylog sorts with its built-in rules. Add GEMINI_API_KEY to switch Gemini on.'}
          </p>
          <div>
            {flag('autoSave', 'Save sorted items straight away', 'Off = review each item before it saves', false)}
            {flag('matchTasks', 'Tick off tasks when I say I did them', '"Done with the gym" completes Gym — legs')}
            {flag('confirm', 'Ask before creating calendar events', 'Shows a confirm card for anything with a time')}
          </div>
          <PromptPreview />
        </Section>

        <Section id="rewards" title="5. Rewards and streaks" desc="How hard your daily goal is and how the app celebrates.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: '1px solid #22262F' }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Check-ins to keep your streak</span>
              <span style={{ fontSize: 13, color: C.dim }}>How many times you log something each day</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 12, background: C.bg, border: `1px solid ${C.border2}` }}>
              <button type="button" aria-label="Fewer check-ins" onClick={() => setSettings({ goal: Math.max(1, s.goal - 1) })} style={{ width: 36, height: 36, borderRadius: 9, border: 'none', background: C.surface2, color: C.text, fontSize: 18 }}>−</button>
              <span style={{ width: 40, textAlign: 'center', fontFamily: HEAD, fontSize: 18, fontWeight: 700 }}>{s.goal}</span>
              <button type="button" aria-label="More check-ins" onClick={() => setSettings({ goal: Math.min(12, s.goal + 1) })} style={{ width: 36, height: 36, borderRadius: 9, border: 'none', background: C.surface2, color: C.text, fontSize: 18 }}>+</button>
            </div>
          </div>
          {flag('sounds', 'Sounds', 'Small click when you finish something')}
          {flag('confetti', 'Celebrations', 'XP pop-ups, confetti on level up')}
          {flag('autoFreeze', 'Use streak freezes automatically', 'Spends one if you miss a day')}
        </Section>

        <Section id="look" title="6. Look" desc="Themes you unlock by levelling up show here. Amethyst is the final one: it needs Level 30 (45,000 XP), which takes most people the best part of a year." gap={16}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
            {THEMES.map((t) => {
              const locked = level < t.lockLvl;
              const on = s.theme === t.name;
              return (
                <button key={t.name} type="button" aria-pressed={on} disabled={locked} onClick={() => setSettings({ theme: t.name })} style={{ padding: 10, borderRadius: 14, border: `2px solid ${on ? C.accent : C.border2}`, background: '#14171D', color: C.text, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', opacity: locked ? 0.55 : 1 }}>
                  <span style={{ height: 70, borderRadius: 9, background: t.bg, display: 'flex', alignItems: 'flex-end', padding: 8, gap: 6 }}>
                    <span style={{ width: 28, height: 8, borderRadius: 99, background: t.accent }} />
                    <span style={{ width: 16, height: 8, borderRadius: 99, background: t.accent2 }} />
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                    <span>{t.name}</span>
                    <span style={{ color: on ? C.accent : C.muted, fontWeight: 500, fontSize: 12 }}>{locked ? `Lv ${t.lockLvl}` : on ? 'In use' : ''}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, paddingTop: 14, borderTop: '1px solid #22262F' }}>
            {seg('Density', 'density', ['Comfortable', 'Compact'])}
            {seg('Week starts on', 'week', ['Mon', 'Sun'])}
            {seg('Time format', 'time', ['24h', '12h'])}
          </div>
        </Section>

        <Section id="reminders" title="7. Reminders" desc="Gentle nudges so you don't lose your streak. They appear while Daylog is open in a tab or installed as an app.">
          {flag('nudges', 'Check-in nudges', 'A ping if you haven’t logged in 4 hours')}
          {flag('evening', 'Evening check-in', '"What was the best part of today?"')}
          {flag('weekly', 'Sunday weekly review', 'A short recap of your week')}
          <label style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: '1px solid #22262F', fontSize: 15, fontWeight: 600 }}>
            <span style={{ flex: 1 }}>Evening check-in time</span>
            <input type="time" value={s.eveningTime} onChange={(e) => e.target.value && setSettings({ eveningTime: e.target.value })} style={{ padding: '9px 12px', borderRadius: 10, background: C.bg, border: '1px solid #3A404D', color: '#fff', fontSize: 14, colorScheme: 'dark' }} />
          </label>
        </Section>

        <Section id="data" title="8. Data and account" desc="Your data lives in your own free Neon Postgres database." gap={14}>
          <DataActions />
          <LogoutRow />
        </Section>
      </main>
    </div>
  );
}

export function LogoutRow() {
  return (
    <button
      type="button" style={{ alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 9, border: 'none', background: 'transparent', color: C.muted, fontSize: 13, textDecoration: 'underline' }}
      onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
    >
      Lock Daylog (log out)
    </button>
  );
}
