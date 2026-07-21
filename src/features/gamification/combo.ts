import { COMBO_TIERS } from "./constants";

/**
 * Streak combo multiplier applied to habit XP (never to coins).
 * @param streak Number of satisfied periods in a row.
 * @returns Multiplier: 1x, 1.2x, 1.5x, 2x, or 3x.
 */
export function comboMultiplier(streak: number): number {
  for (const tier of COMBO_TIERS) {
    if (streak >= tier.min) return tier.mult;
  }
  return 1;
}
