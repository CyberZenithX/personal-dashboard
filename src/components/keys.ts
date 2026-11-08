/** Shared keyboard-shortcut helpers (global handler + Settings → Shortcuts). */
export const keyState = { recording: false };

const ARROWS: Record<string, string> = { ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓' };

/** Turns a KeyboardEvent into the same string format the settings store ("Ctrl + K", "Shift + →", "Space"). */
export function comboFromEvent(e: KeyboardEvent | React.KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  const k = e.key === ' ' ? 'Space' : ARROWS[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  parts.push(k);
  return parts.join(' + ');
}
