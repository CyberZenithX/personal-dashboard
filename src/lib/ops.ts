/** Write operations shared by the API routes. Every function runs inside `mutate()`. */
import { classifyTag } from './ai';
import { sql, query } from './db';
import { normalizeTag, parseQuick } from './parse';
import { addDays, hhmmToMin } from './time';
import { award, unaward, type Ctx, mapNote, NOTE_COLS, QUEST_KEYS } from './state';
import type { EventKind, NoteLink, Prio, SortItem } from './types';

const PRIO_XP: Record<Prio, number> = { high: 25, med: 15, low: 10 };
const ADD_XP = 5;

/* -------------------------------------------------------------------- tasks */

export interface TaskInput {
  title: string;
  tag?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  prio?: Prio;
  sub?: string | null;
  xp?: number;
  parse?: boolean;
  /** with parse: put the task on today when no date was typed */
  defaultToday?: boolean;
  source?: string;
  checkin?: boolean;
  done?: boolean;
}

export async function createTask(c: Ctx, input: TaskInput): Promise<number> {
  let title = input.title.trim();
  let tag = normalizeTag(input.tag);
  // `undefined` = not chosen (detection may fill it in); `null` = explicitly "no date" / "no time".
  let dueDate = input.dueDate ?? null;
  let dueTime = input.dueTime ?? null;
  if (input.parse) {
    const p = parseQuick(title, c.today);
    if (p.title) title = p.title;
    tag ??= normalizeTag(p.tag);
    if (input.dueDate === undefined) dueDate = p.date;
    if (input.dueTime === undefined) dueTime = p.time;
    if (!dueDate && input.defaultToday && input.dueDate === undefined) dueDate = c.today;
  }
  if (!dueDate) dueTime = null;
  if (!title) throw new Error('Title is required');
  if (!tag && !input.tag) tag = await classifyTag(title, 'task', c.settings);
  const prio: Prio = input.prio ?? 'low';
  const xp = input.xp ?? PRIO_XP[prio];
  const source = input.source ?? 'typed';
  const rows = await sql<{ id: number }>`
    insert into tasks (title, tag, due_date, due_time, prio, xp, sub, source)
    values (${title}, ${tag}, ${dueDate}::date, ${dueTime}, ${prio}, ${xp}, ${input.sub ?? null}, ${source})
    returning id::int as id`;
  const id = rows[0].id;
  await award(c, { kind: 'task_add', amount: ADD_XP, label: 'Task added', ref: `add:task:${id}`, checkin: input.checkin ?? true });
  if (input.done) await setTaskDone(c, id, true);
  return id;
}

export async function setTaskDone(c: Ctx, id: number, done: boolean): Promise<string | undefined> {
  // Compare-and-set: only the request that actually flips the flag awards / takes back XP.
  if (done) {
    const r = await sql<{ xp: number; title: string }>`update tasks set done = true, done_at = now() where id = ${id} and not done returning xp, title`;
    if (!r[0]) return (await sql<{ title: string }>`select title from tasks where id = ${id}`)[0]?.title;
    await award(c, { kind: 'task_done', amount: r[0].xp, label: r[0].title, ref: `task:${id}`, checkin: true });
    return r[0].title;
  }
  const r = await sql<{ title: string }>`update tasks set done = false, done_at = null where id = ${id} and done returning title`;
  if (!r[0]) return (await sql<{ title: string }>`select title from tasks where id = ${id}`)[0]?.title;
  await unaward(`task:${id}`);
  return r[0].title;
}

export interface TaskPatch {
  title?: string;
  tag?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  prio?: Prio;
  sub?: string | null;
  done?: boolean;
  pushDays?: number;
}

export async function updateTask(c: Ctx, id: number, p: TaskPatch): Promise<string | undefined> {
  // One UPDATE for all field changes, so a half-applied edit can't be left behind.
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown, cast = '') => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}${cast}`);
  };
  if (p.title !== undefined && p.title.trim()) set('title', p.title.trim());
  if (p.tag !== undefined) set('tag', normalizeTag(p.tag));
  if (p.pushDays) {
    vals.push(c.today, p.pushDays);
    sets.push(`due_date = greatest(coalesce(due_date, $${vals.length - 1}::date), $${vals.length - 1}::date) + $${vals.length}::int`);
  } else if (p.dueDate !== undefined) {
    set('due_date', p.dueDate, '::date');
    if (p.dueDate === null) sets.push('due_time = null');
  }
  if (p.dueTime !== undefined && p.dueDate !== null) set('due_time', p.dueTime);
  if (p.prio !== undefined) {
    set('prio', p.prio);
    // finished tasks keep the XP they were worth when completed
    vals.push(PRIO_XP[p.prio]);
    sets.push(`xp = case when done then xp else $${vals.length}::int end`);
  }
  if (p.sub !== undefined) set('sub', p.sub);
  if (sets.length) {
    vals.push(id);
    await query(`update tasks set ${sets.join(', ')} where id = $${vals.length}`, vals);
  }
  if (p.done !== undefined) return setTaskDone(c, id, p.done);
  return undefined;
}

/** Take a deleted task/event out of any note's links. */
async function unlinkEverywhere(type: 'Task' | 'Event', id: number): Promise<void> {
  await query(
    `update notes set links = coalesce((select jsonb_agg(l) from jsonb_array_elements(links) l
       where not (l->>'type' = $1 and coalesce(l->>'id', '') = $2)), '[]'::jsonb)
     where links @> $3::jsonb`,
    [type, String(id), JSON.stringify([{ type, id }])]
  );
}

export async function deleteTask(_c: Ctx, id: number): Promise<void> {
  await sql`delete from tasks where id = ${id}`;
  await sql`delete from xp_log where ref in (${`add:task:${id}`}, ${`task:${id}`})`;
  await unlinkEverywhere('Task', id);
}

/* -------------------------------------------------------------------- notes */

export interface NoteInput {
  title?: string;
  body?: string;
  tag?: string | null;
  source?: string;
  links?: NoteLink[];
  checkin?: boolean;
}

export async function createNote(c: Ctx, input: NoteInput): Promise<number> {
  const body = (input.body ?? '').trim();
  let title = (input.title ?? '').trim();
  if (!title) title = body.split(/\n/)[0].split(/\s+/).slice(0, 7).join(' ') || 'Untitled note';
  let tag = normalizeTag(input.tag);
  if (!tag && !input.tag) tag = await classifyTag(`${title}\n${body}`, 'note', c.settings);
  const source = input.source ?? 'typed';
  const rows = await sql<{ id: number }>`
    insert into notes (title, body, tag, source, links)
    values (${title}, ${body}, ${tag}, ${source}, ${JSON.stringify(input.links ?? [])}::jsonb)
    returning id::int as id`;
  const id = rows[0].id;
  await award(c, { kind: 'note', amount: ADD_XP, label: 'Note saved', ref: `add:note:${id}`, checkin: input.checkin ?? true });
  return id;
}

export interface NotePatch {
  title?: string;
  body?: string;
  tag?: string | null;
  links?: NoteLink[];
  reclassify?: boolean;
  toTask?: boolean;
}

/** Returns true when `toTask` actually created a task (false if the note already has one). */
export async function updateNote(c: Ctx, id: number, p: NotePatch): Promise<boolean> {
  const cur = await query<Record<string, unknown>>(`select ${NOTE_COLS} from notes where id = $1`, [id]);
  if (!cur[0]) return false;
  const note = mapNote(cur[0]);
  const title = p.title !== undefined ? p.title.trim() || note.title : note.title;
  const body = p.body !== undefined ? p.body : note.body;
  let tag = p.tag !== undefined ? normalizeTag(p.tag) : note.tag;
  if (p.reclassify) tag = (await classifyTag(`${title}\n${body}`, 'note', c.settings)) ?? tag;
  let links = p.links ?? note.links;
  let made = false;
  if (p.toTask) {
    // One task per note: if a linked task still exists, don't make another.
    const ids = links.filter((l) => l.type === 'Task' && l.id).map((l) => l.id as number);
    const existing = ids.length ? await query<{ id: number }>(`select id::int as id from tasks where id = any($1::bigint[])`, [ids]) : [];
    if (!existing.length) {
      const taskId = await createTask(c, { title, tag: null, source: 'note' });
      links = [...links.filter((l) => l.type !== 'Task' || !l.id), { type: 'Task', label: title, id: taskId }];
      made = true;
    }
  }
  const changed = p.title !== undefined || p.body !== undefined;
  await sql`update notes set title = ${title}, body = ${body}, tag = ${tag}, links = ${JSON.stringify(links)}::jsonb,
            updated_at = case when ${changed}::boolean then now() else updated_at end
            where id = ${id}`;
  return made;
}

export async function deleteNote(_c: Ctx, id: number): Promise<void> {
  await sql`delete from notes where id = ${id}`;
  await sql`delete from xp_log where ref = ${`add:note:${id}`}`;
}

async function addNoteLink(noteId: number, link: NoteLink): Promise<void> {
  const cur = await query<Record<string, unknown>>(`select ${NOTE_COLS} from notes where id = $1`, [noteId]);
  if (!cur[0]) return;
  const note = mapNote(cur[0]);
  await sql`update notes set links = ${JSON.stringify([...note.links, link])}::jsonb where id = ${noteId}`;
}

/* ------------------------------------------------------------------- events */

export interface EventInput {
  title: string;
  kind?: EventKind;
  date: string;
  start: string; // HH:MM
  end?: string | null;
  repeatDays?: number[] | null;
  source?: string;
  checkin?: boolean;
  linkNoteId?: number;
}

export async function createEvent(c: Ctx, input: EventInput): Promise<number> {
  const title = input.title.trim();
  if (!title) throw new Error('Title is required');
  const start = hhmmToMin(input.start) ?? 9 * 60;
  let end = endMin(input.end, start);
  if (end <= start) end = Math.min(24 * 60, start + 30);
  const kind: EventKind = input.kind ?? 'event';
  const repeat = kind === 'habit' && input.repeatDays?.length ? input.repeatDays : null;
  const rows = await sql<{ id: number }>`
    insert into events (title, kind, date, start_min, end_min, repeat_days, source)
    values (${title}, ${kind}, ${input.date}::date, ${start}, ${end}, ${repeat}::int[], ${input.source ?? 'typed'})
    returning id::int as id`;
  const id = rows[0].id;
  await award(c, { kind: 'event_add', amount: ADD_XP, label: 'Event added', ref: `add:event:${id}`, checkin: input.checkin ?? true });
  if (input.linkNoteId) await addNoteLink(input.linkNoteId, { type: 'Event', label: title, id });
  return id;
}

export interface EventPatch {
  title?: string;
  kind?: EventKind;
  date?: string;
  start?: string;
  end?: string;
  repeatDays?: number[] | null;
}

export async function updateEvent(_c: Ctx, id: number, p: EventPatch): Promise<void> {
  if (p.title !== undefined && p.title.trim()) await sql`update events set title = ${p.title.trim()} where id = ${id}`;
  if (p.kind !== undefined) await sql`update events set kind = ${p.kind} where id = ${id}`;
  if (p.date !== undefined) await sql`update events set date = ${p.date}::date where id = ${id}`;
  if (p.start !== undefined || p.end !== undefined) {
    const cur = (await sql<{ s: number; e: number }>`select start_min as s, end_min as e from events where id = ${id}`)[0];
    if (cur) {
      const s = p.start !== undefined ? hhmmToMin(p.start) ?? cur.s : cur.s;
      let e = p.end !== undefined ? endMin(p.end, s) : cur.e;
      if (e <= s) e = Math.min(1440, s + 30);
      await sql`update events set start_min = ${s}, end_min = ${e} where id = ${id}`;
    }
  }
  if (p.repeatDays !== undefined) await sql`update events set repeat_days = ${p.repeatDays?.length ? p.repeatDays : null}::int[] where id = ${id}`;
}

/** An end of "00:00" after a later start means midnight at the end of the day. */
function endMin(end: string | null | undefined, start: number): number {
  const e = hhmmToMin(end);
  if (e == null) return start + 30;
  return e === 0 && start > 0 ? 1440 : e;
}

export async function deleteEvent(_c: Ctx, id: number): Promise<void> {
  await sql`delete from events where id = ${id}`;
  await sql`delete from xp_log where ref = ${`add:event:${id}`}`;
  await unlinkEverywhere('Event', id);
}

/* ------------------------------------------------------------- voice capture */

export async function captureItems(c: Ctx, transcript: string, items: SortItem[]): Promise<{ saved: number }> {
  let saved = 0;
  for (const it of items) {
    if (it.type === 'complete' && it.taskId) {
      await setTaskDone(c, it.taskId, true);
      saved++;
    } else if (it.type === 'task') {
      await createTask(c, { title: it.title, tag: it.tag, dueDate: it.date, dueTime: it.time, source: 'voice', checkin: false });
      saved++;
    } else if (it.type === 'event') {
      await createEvent(c, {
        title: it.title, date: it.date ?? c.today, start: it.time ?? '09:00', end: it.endTime, source: 'voice', checkin: false
      });
      saved++;
    } else if (it.type === 'note') {
      await createNote(c, { title: it.title, body: it.body ?? it.title, tag: it.tag, source: 'voice', checkin: false });
      saved++;
    }
  }
  const rows = await sql<{ id: number }>`insert into voice_logs (transcript, item_count) values (${transcript}, ${saved}) returning id::int as id`;
  await award(c, { kind: 'voice', amount: 0, label: 'Voice log', ref: `voice:${rows[0].id}`, checkin: true });
  return { saved };
}

/* ------------------------------------------------------------------ import */

export async function importTasks(
  c: Ctx,
  rows: { title: string; dueDate?: string | null; dueTime?: string | null; prio?: Prio; tag?: string | null; done?: boolean }[]
): Promise<number> {
  let n = 0;
  for (const r of rows.slice(0, 500)) {
    if (!r.title?.trim()) continue;
    // Imports shouldn't farm XP: insert directly and don't award.
    const tag = normalizeTag(r.tag);
    const prio: Prio = r.prio ?? 'low';
    await sql`insert into tasks (title, tag, due_date, due_time, prio, xp, done, done_at, source)
              values (${r.title.trim()}, ${tag}, ${r.dueDate ?? null}::date, ${r.dueTime ?? null}, ${prio}, ${PRIO_XP[prio]},
                      ${!!r.done}, ${r.done ? new Date().toISOString() : null}, 'import')`;
    n++;
  }
  void c;
  return n;
}

export async function resetProgress(c: Ctx): Promise<void> {
  await sql`delete from xp_log`;
  // Voice history is kept. Today's quests were already met before the reset, so mark them as
  // spent (0 XP) — otherwise the quest sync that runs after every write hands the XP straight back.
  for (const key of QUEST_KEYS) {
    await sql`insert into xp_log (kind, amount, label, ref, checkin, day)
              values ('quest', 0, 'reset', ${`quest:${c.today}:${key}`}, false, ${c.today}::date)
              on conflict (ref) where ref is not null do nothing`;
  }
}
