'use client';
import { useEffect, type CSSProperties, type ReactNode, type RefObject } from 'react';

/* Colour tokens. Anything that follows the theme uses a CSS variable (see globals.css). */
export const C = {
  bg: 'var(--bg)',
  accent: 'var(--accent)',
  accent2: 'var(--accent2)',
  accentDim: 'var(--accent-dim)',
  accentLine: 'var(--accent-line)',
  accentRow: 'var(--accent-row)',
  accentRow2: 'var(--accent-row2)',
  glow: 'var(--accent-glow)',
  glow2: 'var(--accent-glow2)',
  text: '#E9ECF2',
  muted: '#A7AFBD',
  dim: '#8D96A6',
  surface: '#181B22',
  surface2: '#1F232C',
  side: '#111318',
  border: '#252A35',
  border2: '#2D3240',
  blue: '#7FB2FF',
  amber: '#FFC85C',
  coral: '#FF9E7A',
  purple: '#D59CFF',
  orange: '#FFB36B',
  red: '#FF7A6B'
} as const;

export const HEAD = "'Space Grotesk Variable', 'Space Grotesk', sans-serif";
export const BODY = "'Inter Variable', Inter, system-ui, sans-serif";
export const MONO = "'JetBrains Mono Variable', 'JetBrains Mono', monospace";

/** Single-path icons used across the design. */
export const ICON = {
  today: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 7v5l3 2',
  tasks: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  notes: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  progress: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3M5 11a7 7 0 0 0 14 0M12 18v3',
  pencil: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l5 5 9-10',
  close: 'M6 6l12 12M18 6L6 18',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  flame: 'M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.5 2 1.5 2.5 2.5 2.5C11 8 11 5 12 3z',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 6l6 6-6 6',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-4-4',
  star: 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  dots: 'M5 12h.01M12 12h.01M19 12h.01'
} as const;

export function Svg({
  d, size = 18, sw = 2, color = 'currentColor', fill = 'none', style
}: { d: string; size?: number; sw?: number; color?: string; fill?: string; style?: CSSProperties }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}
    >
      <path d={d} />
    </svg>
  );
}

export function Toggle({
  on, onChange, label, small
}: { on: boolean; onChange: () => void; label: string; small?: boolean }) {
  const w = small ? 48 : 52;
  const h = small ? 28 : 30;
  const k = small ? 22 : 24;
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
      style={{
        width: w, height: h, borderRadius: 99, border: 'none', background: on ? C.accent : '#3A404D',
        position: 'relative', flex: 'none', transition: 'background .2s', padding: 0
      }}
    >
      <span
        style={{
          position: 'absolute', top: 3, left: on ? w - k - 3 : 3, width: k, height: k, borderRadius: 99,
          background: '#FFFFFF', transition: 'left .2s'
        }}
      />
    </button>
  );
}

export function Pill({
  children, on, onClick, color, style
}: { children: ReactNode; on?: boolean; onClick?: () => void; color?: string; style?: CSSProperties }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={on}
      style={{
        padding: '9px 14px', borderRadius: 99, border: `1px solid ${on ? C.accent : '#3A404D'}`,
        background: on ? C.accentDim : 'transparent', color: on ? C.accent : color ?? '#C3C9D4',
        fontSize: 13, fontWeight: 600, minHeight: 40, ...style
      }}
    >
      {children}
    </button>
  );
}

export const visuallyHidden: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside an open dialog (Tab / Shift+Tab wrap around), moves focus into it when it opens,
 * and puts focus back where it was when it closes.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const before = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const t = setTimeout(() => {
      if (el && !el.contains(document.activeElement)) (el.querySelector<HTMLElement>('[autofocus], ' + FOCUSABLE) ?? el).focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      // only the top-most dialog traps focus
      const dialogs = [...document.querySelectorAll('[aria-modal="true"]')];
      if (dialogs.length && dialogs[dialogs.length - 1] !== el && !el.contains(dialogs[dialogs.length - 1])) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) { e.preventDefault(); el.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      if (before && before.isConnected && typeof before.focus === 'function') setTimeout(() => before.focus(), 0);
    };
  }, [ref, active]);
}
