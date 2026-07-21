import { DIFFICULTY_BASE, TASK_COIN_DISCOUNT, type Difficulty } from "./constants";

/** Default coin value for a new habit of the given difficulty (user-editable later). */
export function defaultCoinValue(difficulty: Difficulty): number {
  return DIFFICULTY_BASE[difficulty];
}

/** Flat coins for completing a one-off task: 75% of a same-effort habit base, rounded. No XP. */
export function taskCoins(difficulty: Difficulty): number {
  return Math.round(DIFFICULTY_BASE[difficulty] * TASK_COIN_DISCOUNT);
}
