import { handle, idParam, mutation, readJson } from '@/lib/api';
import { query } from '@/lib/db';
import { deleteNote, updateNote } from '@/lib/ops';
import { mapNote, NOTE_COLS } from '@/lib/state';
import { BadRequest, optBool, optLinks, optTag, text } from '@/lib/validate';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: P) {
  const raw = (await params).id;
  return handle(async () => {
    const rows = await query(`select ${NOTE_COLS} from notes where id = $1`, [idParam(raw)]);
    if (!rows[0]) throw new BadRequest('Note not found');
    return mapNote(rows[0]);
  });
}

export async function PATCH(req: Request, { params }: P) {
  const raw = (await params).id;
  const b = await readJson(req);
  return mutation(async (c) => {
    const id = idParam(raw);
    const toTask = optBool(b.toTask);
    const made = await updateNote(c, id, {
      title: text(b.title, 'Title', 200),
      body: text(b.body, 'Note', 20000),
      tag: optTag(b.tag),
      links: optLinks(b.links),
      reclassify: optBool(b.reclassify),
      toTask
    });
    return { label: toTask ? (made ? 'Task created' : 'Already a task') : undefined };
  });
}

export async function DELETE(_req: Request, { params }: P) {
  const raw = (await params).id;
  return mutation(async (c) => {
    await deleteNote(c, idParam(raw));
  });
}
