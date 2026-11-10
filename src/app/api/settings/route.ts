import { handle, readJson } from '@/lib/api';
import { levelFor } from '@/lib/levels';
import { DEFAULT_KEYS, DEFAULT_SETTINGS, LISTEN_MODELS, SORT_MODELS, THEMES } from '@/lib/settings';
import { loadState, saveSettings, totalXp } from '@/lib/state';
import type { Settings, TagPair } from '@/lib/types';
import { BadRequest, normTime, TAG_RE } from '@/lib/validate';
import { normalizeTag } from '@/lib/parse';

export const dynamic = 'force-dynamic';

const COLOR_RE = /^#[0-9a-f]{6}$/i;

function tagList(v: unknown, name: string): TagPair[] {
  if (!Array.isArray(v) || v.length > 30) throw new BadRequest(`${name} must be a list of up to 30 tags`);
  const seen = new Set<string>();
  return v.map((pair) => {
    const [t, c] = Array.isArray(pair) ? pair : [];
    const tag = normalizeTag(typeof t === 'string' ? t : null);
    if (!tag || !TAG_RE.test(tag)) throw new BadRequest('Tags can use letters, numbers, - and _ (max 30)');
    if (seen.has(tag)) throw new BadRequest(`${tag} is listed twice`);
    seen.add(tag);
    return [tag, typeof c === 'string' && COLOR_RE.test(c) ? c : '#C3C9D4'] as TagPair;
  });
}

/** Only known settings with valid values get through; everything else is rejected with a clear message. */
async function clean(b: Record<string, unknown>): Promise<Partial<Settings>> {
  const out: Partial<Settings> = {};
  if (b.pages !== undefined) {
    const p = (b.pages ?? {}) as Record<string, unknown>;
    out.pages = {} as Settings['pages'];
    for (const k of Object.keys(DEFAULT_SETTINGS.pages) as (keyof Settings['pages'])[]) if (k in p) out.pages[k] = !!p[k];
  }
  if (b.flags !== undefined) {
    const f = (b.flags ?? {}) as Record<string, unknown>;
    out.flags = {} as Settings['flags'];
    for (const k of Object.keys(DEFAULT_SETTINGS.flags) as (keyof Settings['flags'])[]) if (k in f) out.flags[k] = !!f[k];
  }
  if (b.taskTags !== undefined) out.taskTags = tagList(b.taskTags, 'Task hashtags');
  if (b.noteTags !== undefined) out.noteTags = tagList(b.noteTags, 'Note hashtags');
  if (b.keys !== undefined) {
    const k = b.keys;
    if (!Array.isArray(k) || k.length !== DEFAULT_KEYS.length || k.some((x) => typeof x !== 'string' || !x || x.length > 24)) throw new BadRequest('Invalid shortcuts');
    if (new Set(k).size !== k.length) throw new BadRequest('Two shortcuts use the same key');
    out.keys = k as string[];
  }
  if (b.listenModel !== undefined) {
    if (!LISTEN_MODELS.includes(b.listenModel as string)) throw new BadRequest('Unknown listening model');
    out.listenModel = b.listenModel as string;
  }
  if (b.sortModel !== undefined) {
    if (!SORT_MODELS.includes(b.sortModel as string)) throw new BadRequest('Unknown sorting model');
    out.sortModel = b.sortModel as string;
  }
  if (b.goal !== undefined) out.goal = Math.min(12, Math.max(1, Math.round(Number(b.goal) || 5)));
  if (b.theme !== undefined) {
    const t = THEMES.find((x) => x.name === b.theme);
    if (!t) throw new BadRequest('Unknown theme');
    if (levelFor(await totalXp()) < t.lockLvl) throw new BadRequest(`${t.name} unlocks at level ${t.lockLvl}`);
    out.theme = t.name;
  }
  if (b.density !== undefined) {
    if (b.density !== 'Comfortable' && b.density !== 'Compact') throw new BadRequest('Invalid density');
    out.density = b.density;
  }
  if (b.week !== undefined) {
    if (b.week !== 'Mon' && b.week !== 'Sun') throw new BadRequest('Week must start Mon or Sun');
    out.week = b.week;
  }
  if (b.time !== undefined) {
    if (b.time !== '24h' && b.time !== '12h') throw new BadRequest('Time format must be 24h or 12h');
    out.time = b.time;
  }
  if (b.eveningTime !== undefined) {
    const t = normTime(b.eveningTime);
    if (!t) throw new BadRequest('Evening check-in time must be HH:MM');
    out.eveningTime = t;
  }
  if (b.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: String(b.timezone) });
      out.timezone = String(b.timezone);
    } catch {
      /* unknown time zone: keep the saved one */
    }
  }
  return out;
}

export async function PUT(req: Request) {
  const b = await readJson(req);
  return handle(async () => {
    await saveSettings(await clean(b));
    return { state: await loadState() };
  });
}
