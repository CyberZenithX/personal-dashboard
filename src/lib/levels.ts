/** Level ladder, XP maths and rewards. Pure – used by server and client.
 * Only list rewards that really exist in the app (themes, streak freezes); the rest are just titles. */

export const LADDER: [lvl: number, name: string, xp: number, reward: string][] = [
  [1, 'Starter', 0, 'Daylog unlocked'],
  [2, 'Logger', 100, ''],
  [3, 'Planner', 250, ''],
  [4, 'Doer', 400, '"Ocean" theme'],
  [5, 'Finisher', 550, ''],
  [6, 'Maker', 750, ''],
  [7, 'Builder', 1000, ''],
  [8, 'Operator', 1500, '"Dusk" theme + 1 streak freeze'],
  [9, 'Strategist', 2200, ''],
  [10, 'Architect', 3000, ''],
  [12, 'Captain', 4500, '2nd streak freeze slot'],
  [15, 'Visionary', 7000, '"Gold" theme'],
  [20, 'Legend', 12000, ''],
  [25, 'Icon', 25000, '3rd streak freeze slot'],
  [30, 'Mythic', 45000, '"Amethyst" theme · the final one']
];

export const MAX_LEVEL = 30;

/** XP needed to reach `lvl` (linear between ladder milestones). */
export function thresholdFor(lvl: number): number {
  if (lvl <= 1) return 0;
  if (lvl >= MAX_LEVEL) return LADDER[LADDER.length - 1][2];
  for (let i = 1; i < LADDER.length; i++) {
    const [l1, , x1] = LADDER[i];
    if (lvl <= l1) {
      const [l0, , x0] = LADDER[i - 1];
      return Math.round(x0 + ((x1 - x0) * (lvl - l0)) / (l1 - l0));
    }
  }
  return LADDER[LADDER.length - 1][2];
}

export function levelFor(xp: number): number {
  let lvl = 1;
  for (let l = 2; l <= MAX_LEVEL; l++) {
    if (xp >= thresholdFor(l)) lvl = l;
    else break;
  }
  return lvl;
}

export function titleFor(lvl: number): { name: string; entry: number } {
  let entry = 0;
  for (let i = 0; i < LADDER.length; i++) if (LADDER[i][0] <= lvl) entry = i;
  return { name: LADDER[entry][1], entry };
}

export function nextTitleFor(lvl: number): string | null {
  const { entry } = titleFor(lvl);
  return LADDER[entry + 1]?.[1] ?? null;
}

export function streakFreezeSlots(lvl: number): number {
  return lvl >= 25 ? 3 : lvl >= 12 ? 2 : lvl >= 8 ? 1 : 0;
}

export interface Reward {
  icon: 'theme' | 'freeze' | 'star';
  title: string;
  sub: string;
}

/** Things unlocked by reaching exactly `lvl`. */
export function rewardsAt(lvl: number): Reward[] {
  const out: Reward[] = [];
  const themeAt: Record<number, string> = { 4: 'Ocean', 8: 'Dusk', 15: 'Gold', 30: 'Amethyst' };
  if (themeAt[lvl]) out.push({ icon: 'theme', title: `"${themeAt[lvl]}" theme`, sub: 'Apply from Settings › Look' });
  if (lvl === 8 || lvl === 12 || lvl === 25) {
    out.push({
      icon: 'freeze',
      title: lvl === 8 ? '1 streak freeze' : lvl === 12 ? '2nd streak freeze slot' : '3rd streak freeze slot',
      sub: 'Saves your streak on a missed day'
    });
  }
  const entry = LADDER.find((e) => e[0] === lvl);
  if (entry && !out.length && entry[3]) out.push({ icon: 'star', title: entry[3], sub: `Unlocked at ${entry[1]}` });
  else if (entry && !out.length) out.push({ icon: 'star', title: `New title: ${entry[1]}`, sub: 'Keep the streak alive' });
  if (!entry && !out.length) out.push({ icon: 'star', title: `Level ${lvl}`, sub: 'Keep the streak alive' });
  return out;
}

/** How far through the current level (0–100). Full at the max level. */
export function levelPct(p: { xp: number; level: number; levelXp: number; nextXp: number }): number {
  if (p.level >= MAX_LEVEL || p.nextXp <= p.levelXp) return 100;
  return Math.max(0, Math.min(100, Math.round(((p.xp - p.levelXp) / (p.nextXp - p.levelXp)) * 100)));
}
