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

/** Cosmetics (PLAN.md §9 milestone cosmetics). Only the id→unlock-level maps
 * live here — they're the game rule, mirrored into SQL (gen-sql-constants.ts)
 * and enforced by the profiles RLS gate. The visual details (hex, label) live
 * in the client-only catalog (features/cosmetics/catalog.ts) so this file
 * stays import-free for the Node SQL generator. Kept deliberately in sync:
 * every id here must have a catalog entry. */
export const AVATAR_COLOR_LEVELS: Record<string, number> = {
  violet: 1, // default
  jade: 2, // "Lv 2 custom colors" (PLAN.md §9)
  fire: 5,
  yellow: 10,
  ink: 20,
};
export const TITLE_LEVELS: Record<string, number> = {
  novice: 1, // default
  builder: 5,
  master: 10,
  legend: 20,
};
export const CARD_SKIN_LEVELS: Record<string, number> = {
  plain: 1, // default
  cream: 2,
  mint: 4,
  lavender: 8,
  peach: 15,
};
export const DEFAULT_AVATAR_COLOR = "violet";
export const DEFAULT_TITLE = "novice";
export const DEFAULT_CARD_SKIN = "plain";
