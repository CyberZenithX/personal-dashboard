import { mutation, readJson } from '@/lib/api';
import { query } from '@/lib/db';
import { normalizeTag } from '@/lib/parse';
import { getSettings, saveSettings } from '@/lib/state';
import { BadRequest, TAG_RE } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/**
 * Rename or remove a hashtag and carry the change through to the tasks / notes that use it.
 * Body: { kind: 'taskTags' | 'noteTags', action: 'rename' | 'remove', tag: '#old', to?: '#new' }
 */
export async function POST(req: Request) {
  const b = await readJson(req);
  return mutation(async () => {
    const kind = b.kind === 'noteTags' ? 'noteTags' : b.kind === 'taskTags' ? 'taskTags' : null;
    if (!kind) throw new BadRequest('Unknown tag list');
    const s = await getSettings();
    const list = s[kind];
    const other = s[kind === 'taskTags' ? 'noteTags' : 'taskTags'];
    const from = normalizeTag(typeof b.tag === 'string' ? b.tag : null);
    if (!from || !list.some((t) => t[0] === from)) throw new BadRequest('That tag no longer exists');
    // Items in the other kind's table follow too, unless that list also has this tag.
    const tables = other.some((t) => t[0] === from) ? [kind === 'taskTags' ? 'tasks' : 'notes'] : ['tasks', 'notes'];

    if (b.action === 'remove') {
      let n = 0;
      for (const table of tables) n += (await query(`update ${table} set tag = null where tag = $1 returning id`, [from])).length;
      await saveSettings({ [kind]: list.filter((t) => t[0] !== from) });
      return { label: `Removed ${from}${n ? ` · ${n} item${n === 1 ? '' : 's'} now untagged` : ''}` };
    }
    if (b.action === 'rename') {
      const to = normalizeTag(typeof b.to === 'string' ? b.to : null);
      if (!to || !TAG_RE.test(to)) throw new BadRequest('Tags can use letters, numbers, - and _ (max 30)');
      if (to === from) return {};
      if (list.some((t) => t[0] === to)) throw new BadRequest(`${to} already exists`);
      let n = 0;
      for (const table of tables) n += (await query(`update ${table} set tag = $2 where tag = $1 returning id`, [from, to])).length;
      await saveSettings({ [kind]: list.map((t) => (t[0] === from ? [to, t[1]] : t)) });
      return { label: `Renamed ${from} to ${to}${n ? ` · ${n} item${n === 1 ? '' : 's'} updated` : ''}` };
    }
    throw new BadRequest('Unknown action');
  });
}
