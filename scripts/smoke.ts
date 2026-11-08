/** Quick backend smoke test against the local PGlite database: `npx tsx scripts/smoke.ts` */
import { sortText } from '../src/lib/ai';
import { captureItems, createTask, setTaskDone } from '../src/lib/ops';
import { loadState, mutate } from '../src/lib/state';

(async () => {
  const s = await loadState();
  const p = s.progress;
  console.log('level', p.level, p.title, 'xp', p.xp, 'streak', p.streak, 'best', p.bestStreak, 'freezes', p.freezes, 'today', s.today);
  console.log('quests', JSON.stringify(p.quests), 'overdue', JSON.stringify(p.overdueQuest));
  console.log('badges on:', p.badges.filter((b) => b.on).map((b) => b.label).join(', '));
  console.log('counts', s.tasks.length, s.notes.length, s.events.length, JSON.stringify(s.tasks[2]), JSON.stringify(s.events[0]));

  const r = await mutate(async (c) => {
    const id = await createTask(c, { title: 'Pay DEWA bill fri 6pm #life', parse: true });
    return { label: 'Task added', data: { id } };
  });
  console.log('create ->', r.toast, JSON.stringify(r.state.tasks.at(-1)));

  for (const t of s.tasks.filter((t) => t.dueDate && t.dueDate < s.today && !t.done)) {
    const rr = await mutate(async (c) => ({ label: await setTaskDone(c, t.id, true) }));
    console.log('done', t.title, '->', rr.toast, rr.levelUp ?? '');
  }

  const open = s.tasks.filter((t) => !t.done);
  const sorted = await sortText(
    'Done with the gym, felt strong. Add buy printer ink tomorrow, and remind me Friday to call the dentist. Put a call with Bilal Thursday at 4. Note that the reel about after-hours bots got twice the usual views',
    { settings: s.settings, openTasks: open, today: s.today }
  );
  console.log(JSON.stringify(sorted, null, 1));
  const cap = await mutate(async (c) => {
    await captureItems(c, 'test', sorted.items);
    return { label: 'Voice' };
  });
  console.log('capture ->', cap.toast, cap.state.progress.quests.map((q) => `${q.key}:${q.done}/${q.total}`).join(' '));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
