/**
 * XP, streaks, day scores, quests and badges – all derived from the data in Postgres.
 */
import { sql } from './db';
import { levelFor, nextTitleFor, streakFreezeSlots, thresholdFor, titleFor, MAX_LEVEL } from './levels';
import { addDays, weekStart } from './time';
import type { BadgeState, DayStat, Progress, QuestState, Settings } from './types';

export const QUEST_XP = { checkin: 30, voice: 15, tasks: 25, evening: 10, overdue: 40 } as const;

interface DayRow { d: string; n: number }

function sumRange(days: Record<string, DayStat>, from: string, to: string): number {
  let s = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) s += days[d]?.xp ?? 0;
  return s;
}

function dayScore(checkins: number, goal: number, tasksDone: number, tasksTotal: number, notes: number): number {
  if (!checkins && !tasksDone && !notes) return 0;
  const ck = Math.min(1, checkins / Math.max(1, goal)) * 50;
  const tk = tasksTotal > 0 ? Math.min(1, tasksDone / tasksTotal) * 35 : checkins > 0 ? 35 : 0;
  const nt = notes > 0 ? 15 : 0;
  return Math.round(ck + tk + nt);
}

export async function computeProgress(settings: Settings, today: string): Promise<Progress> {
  const tz = settings.timezone;
  const goal = settings.goal;

  const [xpRows, dueRows, doneRows, noteRows, voiceRows, scalars, overdue, evening, zero] = await Promise.all([
    sql<{ d: string; ck: number; xp: number }>`
      select to_char(day,'YYYY-MM-DD') as d, (count(*) filter (where checkin))::int as ck, coalesce(sum(amount),0)::int as xp
      from xp_log group by day`,
    sql<DayRow>`select to_char(due_date,'YYYY-MM-DD') as d, count(*)::int as n from tasks where due_date is not null group by due_date`,
    sql<{ d: string; n: number; due_n: number }>`
      select to_char((done_at at time zone ${tz})::date,'YYYY-MM-DD') as d, count(*)::int as n,
             (count(*) filter (where due_date = (done_at at time zone ${tz})::date))::int as due_n
      from tasks where done and done_at is not null group by 1`,
    sql<DayRow>`select to_char((created_at at time zone ${tz})::date,'YYYY-MM-DD') as d, count(*)::int as n from notes group by 1`,
    sql<DayRow>`select to_char((created_at at time zone ${tz})::date,'YYYY-MM-DD') as d, count(*)::int as n from voice_logs group by 1`,
    sql<{ tasks_done: number; notes: number; voice: number; linked: number; early: number; first_day: string | null }>`
      select
        (select count(*) from tasks where done)::int as tasks_done,
        (select count(*) from notes)::int as notes,
        (select count(*) from voice_logs)::int as voice,
        (select count(*) from notes where jsonb_array_length(links) > 0)::int as linked,
        (select count(distinct day) from xp_log where checkin and extract(hour from at at time zone ${tz}) < 7)::int as early,
        (select to_char(min(day),'YYYY-MM-DD') from xp_log) as first_day`,
    sql<{ total: number; dn: number }>`
      select count(*)::int as total, (count(*) filter (where done))::int as dn
      from tasks
      where due_date < ${today}::date and (not done or (done_at at time zone ${tz})::date = ${today}::date)`,
    sql<{ n: number }>`
      select count(*)::int as n from notes where source = 'evening' and (created_at at time zone ${tz})::date = ${today}::date`,
    sql<{ n: number }>`
      select count(*)::int as n from generate_series(0, 6) g
      where not exists (
        select 1 from tasks t
        where t.due_date < (${today}::date - g)
          and (t.created_at at time zone ${tz})::date <= (${today}::date - g)
          and (not t.done or (t.done_at at time zone ${tz})::date > (${today}::date - g))
      )`
  ]);

  const dueMap = new Map(dueRows.map((r) => [r.d, r.n]));
  const doneMap = new Map(doneRows.map((r) => [r.d, r]));
  const noteMap = new Map(noteRows.map((r) => [r.d, r.n]));
  const voiceMap = new Map(voiceRows.map((r) => [r.d, r.n]));
  const xpMap = new Map(xpRows.map((r) => [r.d, r]));

  // Day stats for the last 120 days + the coming week
  const days: Record<string, DayStat> = {};
  const from = addDays(today, -120);
  const to = addDays(today, 8);
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const x = xpMap.get(d);
    const dn = doneMap.get(d);
    const checkins = x?.ck ?? 0;
    const tasksDone = dn?.n ?? 0;
    const tasksTotal = (dueMap.get(d) ?? 0) + (dn ? dn.n - dn.due_n : 0);
    const notes = noteMap.get(d) ?? 0;
    days[d] = { checkins, tasksDone, tasksTotal, notes, score: dayScore(checkins, goal, tasksDone, tasksTotal, notes), xp: x?.xp ?? 0 };
  }

  const totalXp = xpRows.reduce((a, r) => a + r.xp, 0);
  const level = levelFor(totalXp);
  const { name: title } = titleFor(level);
  const levelXp = thresholdFor(level);
  const nextXp = level >= MAX_LEVEL ? levelXp : thresholdFor(level + 1);

  // Streak (days with check-ins >= goal). Today pending never breaks it.
  const met = (d: string) => (xpMap.get(d)?.ck ?? 0) >= goal;
  const streakMetToday = met(today);
  const slots = settings.flags.autoFreeze ? streakFreezeSlots(level) : 0;
  let streak = 0;
  let used = 0;
  let cursor = streakMetToday ? today : addDays(today, -1);
  const firstDay = scalars[0]?.first_day ?? null;
  while (firstDay && cursor >= firstDay) {
    if (met(cursor)) streak++;
    else if (used < slots && cursor !== today) {
      // bridge a single missed day with a freeze, but only if the day before it continues the streak
      if (met(addDays(cursor, -1))) used++;
      else break;
    } else break;
    cursor = addDays(cursor, -1);
  }
  let bestStreak = 0;
  if (firstDay) {
    let run = 0;
    for (let d = firstDay; d <= today; d = addDays(d, 1)) {
      run = met(d) ? run + 1 : 0;
      bestStreak = Math.max(bestStreak, run);
    }
  }
  bestStreak = Math.max(bestStreak, streak);

  const t = days[today];
  const quests: QuestState[] = [
    { key: 'checkin', label: `Check in ${goal} times`, done: Math.min(t.checkins, goal), total: goal, xp: QUEST_XP.checkin },
    { key: 'voice', label: 'Log one thing by voice', done: Math.min(1, voiceMap.get(today) ?? 0), total: 1, xp: QUEST_XP.voice },
    { key: 'tasks', label: 'Finish 3 tasks', done: Math.min(3, t.tasksDone), total: 3, xp: QUEST_XP.tasks },
    { key: 'evening', label: 'Write the evening check-in', done: Math.min(1, evening[0]?.n ?? 0), total: 1, xp: QUEST_XP.evening }
  ];

  const ws = weekStart(today, settings.week);
  const weekXp = sumRange(days, ws, addDays(ws, 6));
  const lastWeekXp = sumRange(days, addDays(ws, -7), addDays(ws, -1));
  const paceXpPerDay = sumRange(days, addDays(today, -6), today) / 7;
  let thingsThisWeek = 0;
  for (let d = addDays(today, -6); d <= today; d = addDays(d, 1)) thingsThisWeek += days[d]?.checkins ?? 0;

  // Best XP week in the window (badge)
  let bestWeek = 0;
  for (let w = addDays(ws, -7 * 16); w <= ws; w = addDays(w, 7)) bestWeek = Math.max(bestWeek, sumRange(days, w, addDays(w, 6)));
  const perfect = Object.values(days).some((d) => d.score >= 100);
  const sc = scalars[0] ?? { tasks_done: 0, notes: 0, voice: 0, linked: 0, early: 0, first_day: null };
  const accountOld = !!firstDay && firstDay <= addDays(today, -6);

  const b = (key: string, label: string, sub: string, on: boolean): BadgeState => ({ key, label, sub, on });
  const badges: BadgeState[] = [
    b('first-week', 'First week', '7-day streak', bestStreak >= 7),
    b('talker', 'Talker', '25 voice logs', sc.voice >= 25),
    b('closer', 'Closer', '100 tasks done', sc.tasks_done >= 100),
    b('early-bird', 'Early bird', 'Log before 7am x10', sc.early >= 10),
    b('perfect', 'Perfect day', 'Score 100', perfect),
    b('month', 'Month strong', '30-day streak', bestStreak >= 30),
    b('thinker', 'Thinker', '100 notes', sc.notes >= 100),
    b('zero', 'Zero inbox', 'No overdue x7', accountOld && (zero[0]?.n ?? 0) >= 7),
    b('warrior', 'Week warrior', '1,000 XP in a week', bestWeek >= 1000),
    b('scribe', 'Scribe', '10 notes', sc.notes >= 10),
    b('linked', 'Linked up', '5 linked notes', sc.linked >= 5),
    b('architect', 'Architect', 'Reach level 10', level >= 10)
  ];

  return {
    xp: totalXp,
    xpToday: t.xp,
    level,
    title,
    nextTitle: nextTitleFor(level),
    levelXp,
    nextXp,
    streak,
    bestStreak,
    freezes: Math.max(0, streakFreezeSlots(level) - used),
    streakMetToday,
    days,
    quests,
    overdueQuest: { done: overdue[0]?.dn ?? 0, total: overdue[0]?.total ?? 0 },
    badges,
    weekXp,
    lastWeekXp,
    paceXpPerDay,
    thingsThisWeek
  };
}
