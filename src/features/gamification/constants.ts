/** Base value per difficulty. Habit XP base and default coin value both use this. */
export const DIFFICULTY_BASE = { easy: 10, medium: 20, hard: 35 } as const;
export type Difficulty = keyof typeof DIFFICULTY_BASE;

/** Tasks (one-off) pay this fraction of a same-effort habit's base coins. */
export const TASK_COIN_DISCOUNT = 0.75;

/** Streak combo tiers (in satisfied periods). Applies to XP only. */
export const COMBO_TIERS = [
  { min: 30, mult: 3 },
  { min: 14, mult: 2 },
  { min: 7, mult: 1.5 },
  { min: 3, mult: 1.2 },
] as const;

/** Level curve: reqFor(level) = round(LEVEL_XP_BASE * level^LEVEL_XP_EXPONENT). */
export const LEVEL_XP_BASE = 100;
export const LEVEL_XP_EXPONENT = 1.3;

/** Freeze tokens: streak insurance. Earned every N levels, capped at a small balance. */
export const FREEZE_TOKEN_LEVEL_INTERVAL = 5;
export const FREEZE_TOKEN_MAX_BALANCE = 3;

/** Weekly league tiers, lowest first. Promotion/relegation is rank-based on
 * the existing global weekly leaderboard, not a separate cohort system. */
export const LEAGUE_TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export type LeagueTier = (typeof LEAGUE_TIERS)[number];
export const LEAGUE_PROMOTE_TOP = 3;
export const LEAGUE_RELEGATE_BOTTOM = 3;
