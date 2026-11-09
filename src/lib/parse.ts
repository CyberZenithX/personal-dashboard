/**
 * Natural-language bits for quick-add: "Pay DEWA bill fri 6pm #life".
 * Pure + dependency-free so the client can preview what the server will store.
 */
import { addDays, dow } from './time';

export interface Parsed {
  title: string;
  tag: string | null;
  date: string | null;
  time: string | null;
}

const FULL_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const ABBR: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6
};

function nextWeekday(from: string, target: number): string {
  const diff = (target - dow(from) + 7) % 7;
  return addDays(from, diff);
}

/** "friday" = the coming Friday (today if it is Friday); "next friday" said on a Friday = a week from today. */
function weekdayFrom(today: string, target: number, next: boolean): string {
  const d = nextWeekday(today, target);
  return next && d === today ? addDays(today, 7) : d;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function parseQuick(input: string, today: string): Parsed {
  let text = ' ' + input.trim() + ' ';
  let tag: string | null = null;
  let date: string | null = null;
  let time: string | null = null;

  // #tag
  const tagM = /\s(#[\w-]+)(?=\s)/.exec(text);
  if (tagM) {
    tag = tagM[1].toLowerCase();
    text = text.replace(tagM[0], ' ');
  }

  // time: 6pm, 6:30pm, 18:30, "at 4"
  const tryTime = (): boolean => {
    let m = /\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=[\s,.]|$)/i.exec(text);
    if (m) {
      let h = Number(m[1]) % 12;
      if (m[3].toLowerCase() === 'pm') h += 12;
      time = `${pad(h)}:${m[2] ?? '00'}`;
      text = text.replace(m[0], ' ');
      return true;
    }
    m = /\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=[\s,.]|$)/.exec(text);
    if (m) {
      time = `${pad(Number(m[1]))}:${m[2]}`;
      text = text.replace(m[0], ' ');
      return true;
    }
    m = /\sat\s+(\d{1,2})(?=[\s,.]|$)/i.exec(text);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
      let h = Number(m[1]);
      if (h >= 1 && h <= 6) h += 12; // "call at 4" means 16:00
      time = `${pad(h)}:00`;
      text = text.replace(m[0], ' ');
      return true;
    }
    return false;
  };
  tryTime();

  // day words
  let m: RegExpExecArray | null;
  if ((m = /\s(today)(?![\w'’])/i.exec(text))) {
    date = today;
    text = text.replace(m[0], ' ');
  } else if ((m = /\s(tonight)(?![\w'’])/i.exec(text))) {
    date = today;
    time ??= '20:00';
    text = text.replace(m[0], ' ');
  } else if ((m = /\s(tomorrow|tmrw|tmr)(?![\w'’])/i.exec(text))) {
    date = addDays(today, 1);
    text = text.replace(m[0], ' ');
  } else if ((m = /\snext\s+week(?![\w'’])/i.exec(text))) {
    date = addDays(today, 7);
    text = text.replace(m[0], ' ');
  } else if ((m = new RegExp(`\\s(on\\s+|next\\s+)?(${FULL_DAYS.join('|')})(?![\\w'’])`, 'i').exec(text))) {
    date = weekdayFrom(today, FULL_DAYS.indexOf(m[2].toLowerCase()), !!m[1] && /next/i.test(m[1]));
    text = text.replace(m[0], ' ');
  } else if ((m = /\s(on|next)\s+(sun|mon|tues?|wed|thur?s?|fri|sat)(?![\w'’])/i.exec(text))) {
    date = weekdayFrom(today, ABBR[m[2].toLowerCase()], /next/i.test(m[1]));
    text = text.replace(m[0], ' ');
  } else if ((m = /\s(sun|mon|tues?|wed|thur?s?|fri|sat)\s*$/i.exec(text))) {
    date = nextWeekday(today, ABBR[m[1].toLowerCase()]);
    text = text.replace(m[0], ' ');
  }

  // part of day → time
  if (!time && (m = /\s(?:in the\s+)?(morning|afternoon|evening)(?![\w'’])/i.exec(text)) && (date || /\b(this|in the)\b/i.test(m[0]))) {
    const w = m[1].toLowerCase();
    time = w === 'morning' ? '09:00' : w === 'afternoon' ? '14:00' : '19:00';
    text = text.replace(m[0], ' ');
  }
  if (time && !date) date = today;

  let title = text.replace(/\s+/g, ' ').trim();
  title = title.replace(/\s+(on|at|by|for)$/i, '').replace(/[,;:\-–]+$/, '').trim();
  return { title, tag, date, time };
}

export function normalizeTag(t: string | null | undefined): string | null {
  if (!t) return null;
  let v = t.trim().toLowerCase().replace(/\s+/g, '');
  if (!v || v === 'untagged' || v === '#untagged') return null;
  if (v[0] !== '#') v = '#' + v;
  return v;
}
