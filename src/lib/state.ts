/** Loading the full app state and the mutation wrapper used by every write endpoint. */
import { aiEngine } from './ai';
import { query, sql } from './db';
import { levelFor } from './levels';
import { computeProgress, QUEST_XP } from './progress';
import { mergeSettings } from './settings';
import { ymd } from './time';
import type {
  AppState, EventItem, MutationResult, Note, NoteLink, Settings, Task, VoiceLog, EventKind, Prio
} from './types';

/* ------------------------------------------------------------------ mappers */

type Raw = Record<string, unknown>;
const iso = (ms: unknown) => (ms == null ? null : new Date(Number(ms)).toISOString());

export const TASK_COLS = `id::int as id, title, tag, to_char(due_date,'YYYY-MM-DD') as due_date, due_time, prio, xp, sub, done,
  (extract(epoch from done_at)*1000)::float8 as done_ms, source, (extract(epoch from created_at)*1000)::float8 as created_ms`;
export const NOTE_COLS = `id::int as id, title, body, tag, source, links,
  (extract(epoch from created_at)*1000)::float8 as created_ms, (extract(epoch from updated_at)*1000)::float8 as updated_ms`;
export const EVENT_COLS = `id::int as id, title, kind, to_char(date,'YYYY-MM-DD') as date, start_min, end_min, repeat_days, source`;

export function mapTask(r: Raw): Task {
  return {
    id: Number(r.id), title: String(r.title), tag: (r.tag as string) ?? null,
    dueDate: (r.due_date as string) ?? null, dueTime: (r.due_time as string) ?? null,
    prio: r.prio as Prio, xp: Number(r.xp), sub: (r.sub as string) ?? null, done: !!r.done,
    doneAt: iso(r.done_ms), source: String(r.source), createdAt: iso(r.created_ms) as string
  };
}
export function mapNote(r: Raw): Note {
  let links: NoteLink[] = [];
  try {
    links = typeof r.links === 'string' ? JSON.parse(r.links) : ((r.links as NoteLink[]) ?? []);
  } catch { /* ignore */ }
  return {
    id: Number(r.id), title: String(r.title), body: String(r.body ?? ''), tag: (r.tag as string) ?? null,
    source: String(r.source), links, createdAt: iso(r.created_ms) as string, updatedAt: iso(r.updated_ms) as string
  };
}
export function mapEvent(r: Raw): EventItem {
  return {
    id: Number(r.id), title: String(r.title), kind: r.kind as EventKind, date: String(r.date),
    startMin: Number(r.start_min), endMin: Number(r.end_min),
    repeatDays: Array.isArray(r.repeat_days) ? (r.repeat_days as number[]).map(Number) : null, source: String(r.source)
  };
}

/* ----------------------------------------------------------------- settings */

export async function getSettings(): Promise<Settings> {
  const rows = await sql<{ data: unknown }>`select data from settings where id = 1`;
  return mergeSettings(rows[0]?.data);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = mergeSettings({
    ...current, ...patch,
    pages: { ...current.pages, ...(patch.pages ?? {}) },
    flags: { ...current.flags, ...(patch.flags ?? {}) }
  });
  await sql`insert into settings (id, data) values (1, ${JSON.stringify(next)}::jsonb)
            on conflict (id) do update set data = excluded.data`;
  return next;
}

/* -------------------------------------------------------------------- state */

export async function loadState(): Promise<AppState> {
  const settings = await getSettings();
  const today = ymd(new Date(), settings.timezone);
  const [tasks, notes, events, voice, progress] = await Promise.all([
    query<Raw>(`select ${TASK_COLS} from tasks where not done or done_at > now() - interval '60 days' order by id`),
    query<Raw>(`select ${NOTE_COLS} from notes order by created_at desc limit 300`),
    query<Raw>(`select ${EVENT_COLS} from events where date >= ($1::date - 60) or repeat_days is not null order by date, start_min`, [today]),
    sql<Raw>`select id::int as id, transcript, item_count, (extract(epoch from created_at)*1000)::float8 as created_ms
             from voice_logs order by created_at desc limit 40`,
    computeProgress(settings, today)
  ]);
  return {
    tasks: tasks.map(mapTask),
    notes: notes.map(mapNote),
    events: events.map(mapEvent),
    voiceLogs: voice.map((v): VoiceLog => ({
      id: Number(v.id), transcript: String(v.transcript), itemCount: Number(v.item_count), createdAt: iso(v.created_ms) as string
    })),
    settings, progress, today,
    userName: process.env.APP_USER_NAME || 'Abubakar',
    aiEngine: aiEngine()
  };
}

/* --------------------------------------------------------------- XP / quests */

export interface Ctx {
  settings: Settings;
  today: string;
}

export async function totalXp(): Promise<number> {
  const r = await sql<{ s: number }>`select coalesce(sum(amount),0)::int as s from xp_log`;
  return r[0]?.s ?? 0;
}

export async function award(
  c: Ctx,
  o: { kind: string; amount: number; label?: string; ref?: string; checkin?: boolean }
): Promise<void> {
  await sql`insert into xp_log (kind, amount, label, ref, checkin, day)
            values (${o.kind}, ${o.amount}, ${o.label ?? null}, ${o.ref ?? null}, ${!!o.checkin}, ${c.today}::date)
            on conflict (ref) where ref is not null do nothing`;
}

export async function unaward(ref: string): Promise<void> {
  await sql`delete from xp_log where ref = ${ref}`;
}

export const QUEST_KEYS = ['checkin', 'voice', 'tasks', 'evening', 'overdue'] as const;

/**
 * Quests are awarded once per day when met, and taken back if the user un-does the work.
 * A 0-XP row (written by "Reset progress") marks a quest as spent for the day and is left alone.
 */
async function syncQuests(c: Ctx): Promise<{ completed: string[] }> {
  const p = await computeProgress(c.settings, c.today);
  const want: { key: string; met: boolean; xp: number }[] = [
    ...p.quests.map((q) => ({ key: q.key, met: q.done >= q.total, xp: q.xp })),
    { key: 'overdue', met: p.overdueQuest.total > 0 && p.overdueQuest.done >= p.overdueQuest.total, xp: QUEST_XP.overdue }
  ];
  const existing = await sql<{ ref: string; amount: number }>`select ref, amount from xp_log where ref like ${'quest:' + c.today + ':%'}`;
  const have = new Map(existing.map((r) => [r.ref, Number(r.amount)]));
  const completed: string[] = [];
  for (const q of want) {
    const ref = `quest:${c.today}:${q.key}`;
    if (q.met && !have.has(ref)) {
      await award(c, { kind: 'quest', amount: q.xp, label: q.key, ref });
      completed.push(q.key);
    } else if (!q.met && (have.get(ref) ?? 0) > 0) {
      await unaward(ref);
    }
  }
  return { completed };
}

/**
 * Writes on one server instance run one at a time, so two quick requests (e.g. a double-tap)
 * can't interleave their read-modify-write steps or double-count XP. Each write's own
 * statements are also written to be safe on their own (compare-and-set, unique XP refs).
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

/**
 * Run a write, then re-sync quests and return the fresh state with a toast and level-up info.
 */
export function mutate(
  run: (c: Ctx) => Promise<{ label?: string; data?: Record<string, unknown> } | void>
): Promise<MutationResult> {
  return serial(() => mutateNow(run));
}

async function mutateNow(
  run: (c: Ctx) => Promise<{ label?: string; data?: Record<string, unknown> } | void>
): Promise<MutationResult> {
  const settings = await getSettings();
  const c: Ctx = { settings, today: ymd(new Date(), settings.timezone) };
  const before = await totalXp();
  const out = (await run(c)) || {};
  const { completed } = await syncQuests(c);
  const after = await totalXp();
  const state = await loadState();
  const delta = after - before;
  let toast: string | undefined;
  if (delta > 0) toast = (completed.length ? 'Quest complete · ' : '') + `+${delta} XP` + (out.label ? ` · ${out.label}` : '');
  else if (out.label) toast = out.label;
  const from = levelFor(before);
  const to = levelFor(after);
  return { state, toast, levelUp: to > from ? { from, to } : undefined, data: out.data };
}
