/**
 * Sorting of typed / spoken text into tasks, notes and events.
 *  - With GEMINI_API_KEY: a structured-JSON Gemini call whose schema enum is built from the
 *    user's own hashtags (Settings → Hashtags).
 *  - Without it: a deterministic rule-based sorter, so the app works offline / keyless.
 */
import { buildPrompt, SORT_MODEL_IDS } from './settings';
import { normalizeTag, parseQuick } from './parse';
import { DOW_LONG, dow } from './time';
import type { Settings, SortItem, Task } from './types';

export function aiEngine(): 'gemini' | 'local' {
  return process.env.GEMINI_API_KEY ? 'gemini' : 'local';
}

function geminiModelId(label: string): string {
  const lite = process.env.GEMINI_MODEL_FLASH_LITE || SORT_MODEL_IDS['Gemini 3.5 Flash Lite'];
  const flash = process.env.GEMINI_MODEL_FLASH || SORT_MODEL_IDS['Gemini 3 Flash'];
  return /lite/i.test(label) ? lite : flash;
}

interface Ctx {
  settings: Settings;
  openTasks: Pick<Task, 'id' | 'title' | 'tag'>[];
  today: string;
}

/* ------------------------------------------------------------------ Gemini */

async function callGemini(settings: Settings, system: string, user: string, schema: unknown): Promise<unknown | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = geminiModelId(settings.sortModel);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 }
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) {
      console.error('[ai] gemini http', res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return JSON.parse(text);
  } catch (err) {
    console.error('[ai] gemini failed', err);
    return null;
  }
}

function tagEnum(settings: Settings, kind: 'task' | 'note' | 'any'): string[] {
  const tags =
    kind === 'task' ? settings.taskTags : kind === 'note' ? settings.noteTags : [...settings.taskTags, ...settings.noteTags];
  return [...new Set(tags.map((t) => t[0])), 'untagged'];
}

/* ------------------------------------------------------------- local rules */

const TAG_HINTS: Record<string, RegExp> = {
  '#work': /\b(client|proposal|quote|invoice|email|meeting|workflow|n8n|project|deadline|report|clinic|agency|lead|sales|pitch|contract|reel|deploy|ship|bot)\b/i,
  '#life': /\b(bill|buy|pay|renew|family|dad|mum|mom|car|ink|groceries|rent|visa|dewa|call back|shopping|pick up|book)\b/i,
  '#health': /\b(gym|run|workout|doctor|dentist|sleep|water|walk|stretch|yoga|swim|diet|meditat|legs|cardio)\b/i,
  '#study': /\b(read|chapter|study|assignment|exam|unit|lecture|btec|homework|revise|course|essay|notes? for)\b/i,
  '#ideas': /\b(idea|what if|concept|hook|brainstorm)\b/i,
  '#meetings': /\b(meeting|call with|catch.?up|sync|standup|they want|wants|agreed|discussed)\b/i,
  '#journal': /\b(felt|feeling|today i|grateful|best part|mood|tired|proud|energy)\b/i,
  '#content': /\b(reel|post|caption|video|content|carousel|thread|newsletter|views)\b/i
};

function localTag(text: string, allowed: string[]): string | null {
  for (const tag of allowed) {
    const re = TAG_HINTS[tag];
    if (re && re.test(text)) return tag;
  }
  return null;
}

export async function classifyTag(text: string, kind: 'task' | 'note', settings: Settings): Promise<string | null> {
  const allowed = tagEnum(settings, kind);
  if (aiEngine() === 'gemini') {
    const out = (await callGemini(
      settings,
      buildPrompt(settings) + '\nReturn { "tag": string } only – the single best allowed tag for this ' + kind + '.',
      text,
      { type: 'OBJECT', properties: { tag: { type: 'STRING', enum: allowed } }, required: ['tag'] }
    )) as { tag?: string } | null;
    if (out?.tag) return normalizeTag(out.tag);
  }
  return localTag(text, allowed);
}

const CUE =
  'remind me|add|put|note that|note|call|buy|send|book|schedule|set up|email|text|pay|finish|submit|prepare|record|review|renew|order|pick up|i need to|need to|don\'t forget|i have to|done with|finished|completed';

function splitClauses(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/[.;!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    const pieces = s.split(new RegExp(`\\s*,\\s*(?:and\\s+)?(?=(?:${CUE})\\b)|\\s+and\\s+(?=(?:${CUE})\\b)`, 'i'));
    for (const p of pieces) if (p.trim()) out.push(p.trim());
  }
  return out;
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'done', 'finished', 'my', 'that', 'this', 'did'].includes(w));
}

function matchTask(clause: string, tasks: Ctx['openTasks']): Ctx['openTasks'][number] | null {
  const cw = new Set(words(clause));
  let best: { t: Ctx['openTasks'][number]; score: number } | null = null;
  for (const t of tasks) {
    const tw = words(t.title);
    const hit = tw.filter((w) => cw.has(w)).length;
    if (hit > 0 && (!best || hit > best.score)) best = { t, score: hit };
  }
  return best?.t ?? null;
}

function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function cleanTitle(s: string): string {
  return cap(
    s
      .replace(/^(?:please\s+)?(?:remind me to|remind me|i need to|need to|i have to|don't forget to|don't forget|add|put|schedule|note that|note)\s+(?:a\s+|an\s+|the\s+)?/i, '')
      .replace(/^(?:to\s+)/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function localSort(text: string, ctx: Ctx): SortItem[] {
  const items: SortItem[] = [];
  const allTags = [...ctx.settings.taskTags, ...ctx.settings.noteTags].map((t) => t[0]);
  const taskTags = ctx.settings.taskTags.map((t) => t[0]);
  const noteTags = ctx.settings.noteTags.map((t) => t[0]);

  for (const clause of splitClauses(text)) {
    const p = parseQuick(clause, ctx.today);
    const tag = p.tag && allTags.includes(p.tag) ? p.tag : null;
    const done = /\b(done with|finished|completed|just did|wrapped up)\b/i.test(clause);
    if (done && ctx.settings.flags.matchTasks) {
      const t = matchTask(clause, ctx.openTasks);
      if (t) {
        items.push({ type: 'complete', title: t.title, tag: t.tag, date: null, time: null, endTime: null, taskId: t.id });
        const rest = clause.replace(/^.*?\b(?:done with|finished|completed|just did|wrapped up)\b\s+(?:the\s+|my\s+)?[\w\s—-]*?(?=,|$)/i, '').replace(/^[,\s]+/, '');
        if (rest.length > 3) {
          items.push({
            type: 'note', title: cap(rest.split(/\s+/).slice(0, 6).join(' ')), body: cap(rest),
            tag: localTag(clause, noteTags), date: null, time: null, endTime: null, taskId: null
          });
        }
        continue;
      }
    }
    const isEvent =
      p.time != null && /\b(call|meeting|meet|appointment|lunch|dinner|catch.?up|session|class|lecture|interview|sync|demo)\b/i.test(clause);
    if (isEvent) {
      let title = cleanTitle(p.title.replace(/^(?:a\s+)(?=call|meeting)/i, ''));
      if (/^call with/i.test(title) === false && /\bcall\b/i.test(title)) title = cap(title);
      const [h, m] = (p.time as string).split(':').map(Number);
      const end = h * 60 + m + 30;
      const endTime = `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
      items.push({ type: 'event', title: title || 'Event', tag: null, date: p.date ?? ctx.today, time: p.time, endTime, taskId: null });
      continue;
    }
    const looksTask = new RegExp(`^(?:please\\s+)?(?:${CUE})\\b`, 'i').test(clause) && !/^note\b/i.test(clause);
    if (looksTask) {
      items.push({
        type: 'task', title: cleanTitle(p.title) || cap(clause), tag: tag ?? localTag(clause, taskTags),
        date: p.date, time: p.time, endTime: null, taskId: null
      });
      continue;
    }
    const body = cap(clause.replace(/^note that\s+/i, ''));
    items.push({
      type: 'note', title: cap(body.split(/\s+/).slice(0, 7).join(' ')), body,
      tag: tag ?? localTag(clause, noteTags), date: null, time: null, endTime: null, taskId: null
    });
  }
  return items;
}

/* ------------------------------------------------------------------- public */

export async function sortText(text: string, ctx: Ctx): Promise<{ items: SortItem[]; engine: 'gemini' | 'local' }> {
  const clean = text.trim();
  if (!clean) return { items: [], engine: aiEngine() };
  if (aiEngine() === 'gemini') {
    const tags = tagEnum(ctx.settings, 'any');
    const schema = {
      type: 'OBJECT',
      properties: {
        items: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              type: { type: 'STRING', enum: ['task', 'note', 'event', 'complete'] },
              title: { type: 'STRING' },
              body: { type: 'STRING', nullable: true },
              tag: { type: 'STRING', enum: tags },
              date: { type: 'STRING', nullable: true },
              time: { type: 'STRING', nullable: true },
              endTime: { type: 'STRING', nullable: true },
              taskId: { type: 'INTEGER', nullable: true }
            },
            required: ['type', 'title', 'tag']
          }
        }
      },
      required: ['items']
    };
    const system =
      buildPrompt(ctx.settings) +
      `\n\nToday is ${DOW_LONG[dow(ctx.today)]} ${ctx.today}. Use "date" as YYYY-MM-DD and "time"/"endTime" as 24h HH:MM (null when not stated).` +
      '\nUse "event" only for things with a specific time slot (calls, meetings, appointments). Default event length is 30 minutes.' +
      '\nFor "note", put the original wording in "body". Keep titles short.' +
      '\nOpen tasks (id: title):\n' + (ctx.openTasks.map((t) => `${t.id}: ${t.title}`).join('\n') || '(none)');
    const out = (await callGemini(ctx.settings, system, clean, schema)) as { items?: Record<string, unknown>[] } | null;
    if (out?.items) {
      const ids = new Set(ctx.openTasks.map((t) => t.id));
      const items: SortItem[] = [];
      for (const raw of out.items) {
        const type = raw.type as SortItem['type'];
        if (!['task', 'note', 'event', 'complete'].includes(type)) continue;
        const taskId = typeof raw.taskId === 'number' && ids.has(raw.taskId) ? raw.taskId : null;
        if (type === 'complete' && (taskId == null || !ctx.settings.flags.matchTasks)) continue;
        const time = typeof raw.time === 'string' && /^\d{1,2}:\d{2}$/.test(raw.time) ? raw.time.padStart(5, '0') : null;
        const endTime = typeof raw.endTime === 'string' && /^\d{1,2}:\d{2}$/.test(raw.endTime) ? raw.endTime.padStart(5, '0') : null;
        const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
        const title = String(raw.title ?? '').trim();
        if (!title) continue;
        items.push({
          type, title, tag: normalizeTag(typeof raw.tag === 'string' ? raw.tag : null), date, time, endTime, taskId,
          body: typeof raw.body === 'string' ? raw.body : undefined
        });
      }
      return { items, engine: 'gemini' };
    }
    // Gemini unavailable right now → fall through to local rules.
  }
  return { items: localSort(clean, ctx), engine: 'local' };
}
