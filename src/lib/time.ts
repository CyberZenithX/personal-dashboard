/** Date helpers. All "calendar day" strings are YYYY-MM-DD in the user's timezone. */

export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function ymd(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

/** 0 = Sunday … 6 = Saturday */
export function dow(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function parts(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m, d };
}

export function minutesOfDay(d: Date, tz: string): number {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const h = Number(f.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(f.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function weekStart(day: string, startsOn: 'Mon' | 'Sun'): string {
  const w = dow(day);
  const back = startsOn === 'Mon' ? (w + 6) % 7 : w;
  return addDays(day, -back);
}

export function hhmmToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minToHhmm(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return String(h).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

export function fmtTime(hhmm: string | null | undefined, mode: '24h' | '12h'): string {
  const min = hhmmToMin(hhmm);
  if (min == null) return '';
  if (mode === '24h') return minToHhmm(min);
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}

export function fmtMin(min: number, mode: '24h' | '12h'): string {
  return fmtTime(minToHhmm(min), mode);
}

export function fmtClockHour(h: number, mode: '24h' | '12h'): string {
  return mode === '24h' ? String(h).padStart(2, '0') + ':00' : `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'pm' : 'am'}`;
}

/** "Fri 6 Nov" */
export function shortDate(day: string): string {
  const { m, d } = parts(day);
  return `${DOW_SHORT[dow(day)]} ${d} ${MONTH_SHORT[m - 1]}`;
}

export function timeOfDayFromIso(iso: string, tz: string): string {
  return minToHhmm(minutesOfDay(new Date(iso), tz));
}
