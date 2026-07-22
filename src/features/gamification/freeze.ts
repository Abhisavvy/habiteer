import { FREEZE_TOKEN_LEVEL_INTERVAL } from "./constants";

/** Freeze tokens earned crossing from levelBefore to levelAfter (usually 0, occasionally 1+). */
export function tokensEarnedBetweenLevels(levelBefore: number, levelAfter: number): number {
  return (
    Math.floor(levelAfter / FREEZE_TOKEN_LEVEL_INTERVAL) - Math.floor(levelBefore / FREEZE_TOKEN_LEVEL_INTERVAL)
  );
}
