/** Client-side view helpers shared by desktop and phone screens. */
import { addDays, diffDays, dow, fmtTime, MONTH_SHORT, parts, shortDate, timeOfDayFromIso, DOW_SHORT } from './time';
import type { EventItem, Note, Settings, Task, TagPair } from './types';

export function tagColor(tags: TagPair[], tag: string | null): string {
  if (!tag) return '#8D96A6';
  return tags.find((t) => t[0] === tag)?.[1] ?? '#C3C9D4';
}

export function allTagColor(settings: Settings, tag: string | null): string {
  return tagColor([...settings.taskTags, ...settings.noteTags], tag);
}

export function kindLabel(tag: string | null): string {
  if (!tag) return 'NOTE';
  const w = tag.replace('#', '').toUpperCase();
  return w.length > 4 && w.endsWith('S') ? w.slice(0, -1) : w;
}

export type Group = 'Overdue' | 'Today' | 'Tomorrow' | 'This week' | 'Later' | 'Someday' | 'Done';

export function taskGroup(t: Task, today: string): Group {
  if (!t.dueDate) return 'Someday';
  if (t.dueDate < today) return 'Overdue';
  if (t.dueDate === today) return 'Today';
  if (t.dueDate === addDays(today, 1)) return 'Tomorrow';
  if (diffDays(t.dueDate, today) <= 7) return 'This week';
  return 'Later';
}

export function dueLabel(t: Task, today: string, tz: string, mode: '24h' | '12h'): string {
  const time = t.dueTime ? fmtTime(t.dueTime, mode) : '';
  if (t.done && t.doneAt && t.dueDate === today) return `Today · done ${fmtTime(timeOfDayFromIso(t.doneAt, tz), mode)}`;
  if (!t.dueDate) return 'No date';
  const diff = diffDays(t.dueDate, today);
  const base = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : shortDate(t.dueDate);
  return time ? `${base} · ${time}` : base;
}

/** Events (incl. repeating habits) that fall on `day`. */
export function eventsOn(events: EventItem[], day: string): EventItem[] {
  return events
    .filter((e) => (e.repeatDays?.length ? e.date <= day && e.repeatDays.includes(dow(day)) : e.date === day))
    .sort((a, b) => a.startMin - b.startMin);
}

export function dayLabel(iso: string, today: string, tz: string): string {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const diff = diffDays(today, d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return shortDate(d);
}

export function noteWhen(n: Note, today: string, tz: string, mode: '24h' | '12h'): string {
  const label = dayLabel(n.updatedAt > n.createdAt && n.updatedAt.slice(0, 16) !== n.createdAt.slice(0, 16) ? n.createdAt : n.createdAt, today, tz);
  if (label === 'Today') return `Today · ${fmtTime(timeOfDayFromIso(n.createdAt, tz), mode)}`;
  return label;
}

export function longDate(day: string): string {
  const { m, d } = parts(day);
  return `${d} ${MONTH_SHORT[m - 1]}`;
}

export { DOW_SHORT };
