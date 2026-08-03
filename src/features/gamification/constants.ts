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

/** Weekly quests (v3 Gap #3 — "why show up this week"). Progress is derived
 * from this week's completions; a quest is claimed once per ISO week for a
 * coin reward via fn_claim_quest (server-authoritative). Goals/rewards/metrics
 * are mirrored into SQL (gen-sql-constants.ts) so the claim RPC and the client
 * can't drift. An optional activeFrom/activeUntil window makes a quest a
 * limited-time EVENT (hidden + unclaimable outside the window); windows are
 * configured/rotated by hand here (no cron). Reward is COINS only — never XP,
 * which would perturb levels/leagues. */
export type QuestMetric = "completions" | "active_days" | "coins_earned";
export type QuestDef = {
  id: string;
  metric: QuestMetric;
  goal: number;
  reward: number; // coins
  activeFrom?: string; // ISO date, inclusive — event window start
  activeUntil?: string; // ISO date, inclusive — event window end
};
export const QUESTS: QuestDef[] = [
  { id: "busy_bee", metric: "completions", goal: 15, reward: 40 },
  { id: "steady", metric: "active_days", goal: 5, reward: 30 },
  { id: "coin_rush", metric: "coins_earned", goal: 200, reward: 50 },
  // Example limited-time EVENT (manually windowed); higher reward, this week only.
  { id: "weekend_warrior", metric: "completions", goal: 8, reward: 60, activeFrom: "2026-07-20", activeUntil: "2026-07-27" },
];

/** Phase P — staked pledges on long-horizon goals (PLAN.md: the "goals don't
 * connect to the player" rework). You stake coins to commit; four checkpoints
 * pay the stake back in pieces as you progress; finishing returns the whole
 * stake plus a bonus. Missing the window forfeits only what you never banked,
 * so partial effort still gets partial credit — which matters because this app
 * is otherwise deliberately gentle (freeze tokens, today-grace, no resets).
 *
 * Mirrored into SQL by gen-sql-constants.ts: the RPCs are authoritative, so
 * these numbers MUST exist in both places or the server and the UI disagree
 * about what a checkpoint is worth. */
export const GOAL_CHECKPOINT_COUNT = 4;
/** Completion bonus as a fraction of the stake (stake 50 → +25). */
export const GOAL_BONUS_PCT = 0.5;
/** Smallest stake worth the ceremony — also the floor for earning the title. */
export const GOAL_STAKE_MIN = 10;
/** Hard floor on a pledge's target, enforced in SQL as a CHECK.
 *
 * This is a coin-printer guard, not ergonomics: checkpoint i's threshold is
 * ceil(target * i / COUNT), so at target 1 all four thresholds are 1 — a
 * single completion would return the entire stake plus the bonus, repeatable
 * daily. Must stay >= GOAL_CHECKPOINT_COUNT so the four thresholds are
 * genuinely distinct. */
export const GOAL_TARGET_MIN = 8;
/** Shortest pledge window in days — a 1-day window with an 8× target is
 * unreachable-by-construction, and unreachable is punitive once money is on
 * the line. */
export const GOAL_MIN_WINDOW_DAYS = 7;
