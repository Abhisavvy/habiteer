import { DIFFICULTY_BASE, type Difficulty } from "./constants";
import { comboMultiplier } from "./combo";

/** XP awarded for completing a habit at a given streak (combo applies). */
export function xpForHabit(difficulty: Difficulty, streak: number): number {
  return Math.round(DIFFICULTY_BASE[difficulty] * comboMultiplier(streak));
}

/** XP required to clear a given level. */
function reqFor(level: number): number {
  return Math.round(100 * Math.pow(level, 1.3));
}

/**
 * Resolve total lifetime XP into a level and progress within it.
 * @returns level (1-based), intoLevel (XP into current level), need (XP to clear it).
 */
export function levelInfo(totalXp: number): { level: number; intoLevel: number; need: number } {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= reqFor(level)) {
    remaining -= reqFor(level);
    level += 1;
  }
  return { level, intoLevel: remaining, need: reqFor(level) };
}
