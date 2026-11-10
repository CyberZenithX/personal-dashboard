'use client';
import { useEffect, useRef } from 'react';
import { useApp } from '../store';
import { C, ICON, Svg, useDialogFocus, visuallyHidden } from '../ui';
import { fmtElapsed, useVoice } from '../useVoice';
import { itemSub, ReviewFields } from '../desktop/Voice';

export default function PhoneVoice({ onClose }: { onClose: () => void; overlay?: boolean }) {
  const v = useVoice(onClose);
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') v.cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const { state } = useApp();
  const s = state.settings;
  const listening = v.mode === 'listening';
  const live = listening && v.supported && !v.showTyping;

  return (
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pvoice-h" style={{ outline: 'none', minHeight: '100dvh', background: '#07080B', color: C.text, padding: 'max(24px, env(safe-area-inset-top)) 20px max(28px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 id="pvoice-h" style={visuallyHidden}>Voice capture</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" onClick={v.cancel} aria-label="Close" style={{ width: 44, height: 44, borderRadius: 99, border: 'none', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text }}>
          <Svg d={ICON.close} size={18} sw={2.4} />
        </button>
        <span role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: live && v.ready ? '#FF6B5C' : '#5A6273' }} />
          {listening ? (live ? (v.starting || !v.ready ? 'Starting microphone…' : `Listening · ${fmtElapsed(v.elapsed)}`) : 'Type or dictate') : v.mode === 'review' ? 'Review before saving' : 'Saving…'}
        </span>
        <span style={{ width: 44 }} />
      </div>

      {v.supported && !v.showTyping ? (
        <p style={{ margin: '8px 0 0', fontSize: 21, lineHeight: 1.5, color: '#fff', minHeight: 64 }}>
          {v.text ? <>“{v.finalText}<span style={{ color: C.dim }}>{v.interim}{listening ? '…' : ''}</span>”</> : <span style={{ color: C.dim }}>Say what’s on your mind — tasks, notes, plans.</span>}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {v.error && <span role="alert" style={{ fontSize: 13, color: C.accent2 }}>{v.error}</span>}
          <label htmlFor="ptyped" style={{ fontSize: 13, color: C.muted }}>Type, or tap the mic on your keyboard to dictate.</label>
          <textarea id="ptyped" autoFocus value={v.typed} onChange={(e) => v.setTyped(e.target.value)} rows={5} placeholder="Done with the gym. Add buy printer ink tomorrow…" style={{ padding: 14, borderRadius: 14, background: C.bg, border: '1px solid #3A404D', color: '#fff', fontSize: 18, lineHeight: 1.5, outline: 'none', fontFamily: 'inherit', resize: 'none' }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 11, color: C.muted, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Sorted with your tags · {v.chip}{v.sorting ? ' · …' : ''}
        </span>
        {v.items.map((it, i) => {
          const matched = it.type === 'complete' ? state.tasks.find((x) => x.id === it.taskId) : undefined;
          const done = it.type === 'complete';
          const tone = { task: ['#1F2A3D', C.blue, 'Task'], event: ['#2A1C33', C.purple, 'Event'], note: ['#2E2614', C.amber, 'Note'], complete: ['', '', ''] }[it.type];
          return (
            <div key={i} style={{ padding: 14, borderRadius: 14, background: done ? C.accentRow : C.surface, border: `1px solid ${done ? C.accentLine : C.border2}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 24, height: 24, borderRadius: done ? 99 : 7, background: done ? C.accent : tone[0], color: tone[1], display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                {done ? <Svg d={ICON.check} size={13} sw={3.5} color="var(--bg)" /> : <Svg d={it.type === 'note' ? ICON.pencil : it.type === 'event' ? ICON.calendar : ICON.plus} size={14} sw={2.4} />}
              </span>
              {v.mode === 'review' && !done ? (
                <span style={{ flex: 1, minWidth: 0 }}><ReviewFields it={it} onChange={(patch) => v.updateItem(i, patch)} /></span>
              ) : (
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{done ? `${it.title} marked done` : it.type === 'note' ? `“${it.title}”` : it.title}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{done ? 'Matched existing task' : `${tone[2]} · ${itemSub(it, s.time, matched?.title)}`}</span>
                </span>
              )}
              {v.mode === 'review' ? (
                <button type="button" aria-label={`Remove ${it.title}`} onClick={() => v.removeItem(i)} style={{ width: 44, height: 44, margin: -10, border: 'none', background: 'transparent', color: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg d={ICON.close} size={16} sw={2.6} /></button>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, color: done ? C.accent : C.dim }}>+{done ? matched?.xp ?? 10 : 5}</span>
              )}
            </div>
          );
        })}
        {!v.items.length && <span style={{ fontSize: 13, color: C.dim }}>Items appear here as you speak.</span>}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {live && (
          <div aria-hidden="true" style={{ display: 'flex', gap: 5, alignItems: 'center', height: 34 }}>
            {[0, 0.15, 0.3, 0.45, 0.3, 0.15].map((d, i) => <span key={i} style={{ width: 4, height: 34, borderRadius: 9, background: C.accent, animation: `bar 1s infinite ${d}s` }} />)}
          </div>
        )}
        {v.mode === 'review' ? (
          <button type="button" onClick={v.saveReview} style={{ width: '100%', padding: 16, borderRadius: 16, border: 'none', background: C.accent, color: 'var(--bg)', fontSize: 16, fontWeight: 700 }}>Save all · +{v.xp} XP</button>
        ) : (
          <button type="button" onClick={v.finish} disabled={v.mode === 'saving'} aria-label="Stop and save" style={{ width: 88, height: 88, borderRadius: 99, border: 'none', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: live ? 'pulse 1.6s infinite' : undefined, opacity: v.mode === 'saving' ? 0.6 : 1 }}>
            <span style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--bg)' }} />
          </button>
        )}
        <span style={{ fontSize: 13, color: C.muted }}>
          {v.mode === 'review' ? 'Fix or remove anything before saving' : <>Tap to save all · <span style={{ color: C.accent, fontWeight: 600 }}>+{v.xp} XP</span></>}
        </span>
        {v.supported && listening && (
          <button type="button" onClick={() => v.setShowTyping(!v.showTyping)} style={{ border: 'none', background: 'transparent', color: C.muted, fontSize: 13, textDecoration: 'underline', minHeight: 44 }}>
            {v.showTyping ? 'Use the microphone' : 'Type instead'}
          </button>
        )}
      </div>
    </div>
  );
}
