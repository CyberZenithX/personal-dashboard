/** Input checking for the API routes. Anything invalid throws BadRequest, which the API layer turns into a 400. */
import { normalizeTag } from './parse';
import type { EventKind, NoteLink, Prio, SortItem } from './types';

export class BadRequest extends Error {
  readonly status = 400;
}

const fail = (msg: string): never => {
  throw new BadRequest(msg);
};

export function isYmd(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && y <= 2200 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "9:05" / "09:05" -> "09:05"; anything else -> null */
export function normTime(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function text(v: unknown, name: string, max: number, required = false): string | undefined {
  if (v === undefined || v === null) return required ? fail(`${name} is required`) : undefined;
  if (typeof v !== 'string') return fail(`${name} must be text`);
  const t = v.trim();
  if (required && !t) fail(`${name} is required`);
  if (t.length > max) fail(`${name} is too long (max ${max} characters)`);
  return t;
}

/** undefined = not given; null / "" = cleared */
export function optDate(v: unknown, name = 'Date'): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return isYmd(v) ? v : fail(`${name} must be a real date (YYYY-MM-DD)`);
}

export function optTime(v: unknown, name = 'Time'): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return normTime(v) ?? fail(`${name} must be HH:MM (00:00–23:59)`);
}

export function optBool(v: unknown): boolean | undefined {
  return v === undefined ? undefined : !!v;
}

const PRIOS: Prio[] = ['high', 'med', 'low'];
export function optPrio(v: unknown): Prio | undefined {
  if (v === undefined) return undefined;
  return PRIOS.includes(v as Prio) ? (v as Prio) : fail('Priority must be high, med or low');
}

export const TAG_RE = /^#[\p{L}\p{N}_-]{1,30}$/u;
export function optTag(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v !== 'string') return fail('Tag must be text');
  const t = normalizeTag(v);
  if (t === null) return null;
  return TAG_RE.test(t) ? t : fail('Tags can use letters, numbers, - and _ (max 30)');
}

function safeTag(v: unknown): string | null {
  try {
    return optTag(v) ?? null;
  } catch {
    return null;
  }
}

const KINDS: EventKind[] = ['event', 'task', 'habit'];
export function optKind(v: unknown): EventKind | undefined {
  if (v === undefined) return undefined;
  return KINDS.includes(v as EventKind) ? (v as EventKind) : fail('Kind must be event, task or habit');
}

export function optDays(v: unknown): number[] | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (!Array.isArray(v) || v.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return fail('Repeat days must be 0–6');
  return [...new Set(v as number[])].sort();
}

export function optInt(v: unknown, name: string, min: number, max: number): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fail(`${name} must be a whole number ${min}–${max}`);
}

export function optLinks(v: unknown): NoteLink[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > 50) return fail('Links must be a list');
  return v.map((l) => {
    const o = (l ?? {}) as Record<string, unknown>;
    if (o.type !== 'Task' && o.type !== 'Event') fail('Link type must be Task or Event');
    return { type: o.type as NoteLink['type'], label: String(o.label ?? '').slice(0, 300), id: optInt(o.id, 'Link id', 1, 2 ** 31 - 1) };
  });
}

/** Items coming back from the review screen / sorter before they're saved. */
export function sortItems(v: unknown): SortItem[] {
  if (!Array.isArray(v)) return [];
  const out: SortItem[] = [];
  for (const raw of v.slice(0, 30)) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const type = o.type as SortItem['type'];
    if (!['task', 'note', 'event', 'complete'].includes(type)) continue;
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 300) : '';
    if (!title) continue;
    const time = normTime(o.time);
    out.push({
      type, title,
      tag: safeTag(o.tag),
      date: isYmd(o.date) ? o.date : null,
      time,
      endTime: time ? normTime(o.endTime) : null,
      taskId: optInt(o.taskId, 'Task id', 1, 2 ** 31 - 1) ?? null,
      body: typeof o.body === 'string' ? o.body.slice(0, 20000) : undefined
    });
  }
  return out;
}
