/**
 * Optional demo data that mirrors the Daylog design mock-ups (Level ~7, a 12-day streak, a busy week).
 *   npm run db:seed            -> only if the database is empty
 *   npm run db:seed -- --force -> wipe tasks/notes/events/xp first
 */
import { sql } from '../src/lib/db';
import { createEvent, createNote, createTask, setTaskDone } from '../src/lib/ops';
import { getSettings, saveSettings } from '../src/lib/state';
import { addDays, weekStart, ymd } from '../src/lib/time';

async function main() {
  const force = process.argv.includes('--force');
  const existing = await sql<{ n: number }>`select count(*)::int as n from tasks`;
  if (existing[0].n > 0 && !force) {
    console.log('[seed] database already has data – use --force to replace it');
    return;
  }
  await wipe(force);

  const tz = process.env.SEED_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  await saveSettings({ timezone: tz });
  const settings = await getSettings();
  const today = ymd(new Date(), tz);
  const c = { settings, today };

  const T = (title: string, tag: string, dueDate: string | null, dueTime: string | null, prio: 'high' | 'med' | 'low', sub?: string) =>
    createTask(c, { title, tag, dueDate, dueTime, prio, sub: sub ?? null, checkin: false });

  await T('Renew car registration', '#life', addDays(today, -1), null, 'high');
  await T('Reply to clinic follow-up email', '#work', addDays(today, -2), null, 'med');
  await T('Send client proposal', '#work', today, '18:00', 'high', '2 / 4 subtasks');
  const n8n = await T('Review n8n workflow', '#work', today, '16:40', 'med');
  await T('Gym — legs', '#health', today, '18:30', 'med', 'Repeats Sun, Tue, Thu');
  await T('Call dad back', '#life', today, null, 'low');
  await T('Record agency reel', '#work', today, null, 'med');
  await T('Read chapter 4 for BTEC unit', '#study', addDays(today, 1), null, 'med');
  await T('Buy printer ink', '#life', addDays(today, 1), null, 'low');
  await setTaskDone(c, n8n, true);
  await sql`update tasks set done_at = (${today}::date + '16:40'::time) at time zone ${tz} where id = ${n8n}`;
  await sql`update xp_log set checkin = false where ref = ${'task:' + n8n}`;

  const N = (title: string, body: string, tag: string, source = 'typed', links: { type: 'Task' | 'Event'; label: string }[] = []) =>
    createNote(c, { title, body, tag, source, links, checkin: false });
  const back = (id: Promise<number>, day: string, time: string) => id.then((i) => sql`update notes set created_at = (${day}::date + ${time}::time) at time zone ${tz}, updated_at = (${day}::date + ${time}::time) at time zone ${tz} where id = ${i}`);
  await back(
    N('Clinic call — what they need',
      'They lose bookings after 8pm because nobody answers WhatsApp.\n\nWant: auto-replies, booking straight into their calendar, reminder the day before.\n\nNext step: send quote by Tuesday morning.',
      '#meetings', 'typed', [{ type: 'Task', label: 'Send clinic quote' }, { type: 'Event', label: 'Thu follow-up call' }]),
    today, '10:52');
  await back(
    N('Reel idea from the car',
      '"Your receptionist sleeps. Your bot doesn’t." Open on a dark office at 2am, phone lights up, bot replies in 3 seconds.',
      '#content', 'voice', [{ type: 'Task', label: 'Record agency reel' }]),
    today, '13:25');
  await back(N('Morning plan', 'Main thing today: get the proposal out.\nTwo calls before lunch. Gym at 6:30.\nFeeling: focused, slightly tired.', '#journal'), today, '07:10');
  await back(N('Streak freeze as a reward', 'Earn a streak freeze each level up. Max 2 saved at a time.', '#ideas'), addDays(today, -1), '20:30');
  await back(N('Best part of the day', 'Lecture went well. Finished the n8n review early and had the evening free.', '#journal'), addDays(today, -2), '21:40');

  // A week of events (Mon-start)
  const ws = weekStart(today, settings.week);
  const E = (offset: number, title: string, start: string, end: string, kind: 'event' | 'task' | 'habit', repeat?: number[]) =>
    createEvent(c, { title, date: addDays(ws, offset), start, end, kind, repeatDays: repeat, checkin: false });
  await E(0, 'Gym', '07:00', '08:00', 'habit', [0, 2, 4]);
  await E(0, 'Deep work: proposal', '09:00', '11:30', 'task');
  await E(0, 'Team sync', '14:00', '15:00', 'event');
  await E(1, 'Client onboarding', '10:00', '11:00', 'event');
  await E(1, 'Build WhatsApp flow', '13:00', '16:00', 'task');
  await E(2, 'Lecture', '09:00', '12:00', 'event');
  await E(2, 'Edit reel', '15:00', '16:30', 'task');
  await E(3, 'Sales calls', '11:00', '13:00', 'event');
  await E(3, 'Course prep', '17:00', '19:00', 'task');
  await E(3, 'Late client call', '21:30', '22:15', 'event');
  await E(4, 'Jumu’ah', '12:15', '13:30', 'habit');
  await E(4, 'Family time', '16:00', '19:00', 'event');
  await E(5, 'Lecture', '09:00', '12:00', 'event');
  await E(5, 'n8n review', '14:00', '15:30', 'task');
  await E(6, 'Client call — clinic', '10:00', '10:45', 'event');
  await E(6, 'Night study', '21:00', '22:30', 'task');

  for (let k = 0; k < 4; k++) await sql`insert into xp_log (kind, amount, label, checkin, day) values ('seed', 6, 'today', true, ${today}::date)`;

  // History so the streak, heatmap and level look like the design
  for (let i = 1; i <= 84; i++) {
    const day = addDays(today, -i);
    const streakZone = i <= 12;
    const wobble = Math.abs(Math.sin(i * 2.3) + Math.cos(i * 0.7));
    const n = streakZone ? 5 + (i % 3) : i % 17 === 0 ? 0 : Math.min(7, Math.round(wobble * 2.4));
    for (let k = 0; k < n; k++) {
      await sql`insert into xp_log (kind, amount, label, checkin, day) values ('seed', ${streakZone ? (k === 0 ? 24 : 8) : 2}, 'history', true, ${day}::date)`;
    }
  }
  console.log('[seed] demo data loaded (timezone ' + tz + ')');
}

async function wipe(force: boolean) {
  if (!force) return;
  await sql`delete from xp_log`;
  await sql`delete from voice_logs`;
  await sql`delete from events`;
  await sql`delete from notes`;
  await sql`delete from tasks`;
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
