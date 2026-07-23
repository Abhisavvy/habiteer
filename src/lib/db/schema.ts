import { pgTable, uuid, text, integer, timestamp, date, unique } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // == auth.users.id
  displayName: text("display_name").notNull(),
  avatar: text("avatar").notNull(), // vestigial (set to '' at signup, never rendered — client draws initial-letter avatars)
  avatarColor: text("avatar_color").notNull().default("violet"), // equipped cosmetic; RLS-gated by level
  titleId: text("title_id").notNull().default("novice"), // equipped cosmetic; RLS-gated by level
  cardSkin: text("card_skin").notNull().default("plain"), // equipped account-wide card skin; RLS-gated by level
  avatarColor: text("avatar_color").notNull().default("violet"), // equipped cosmetic; RLS-gated by level
  titleId: text("title_id").notNull().default("novice"), // equipped cosmetic; RLS-gated by level
  avatarColor: text("avatar_color").notNull().default("violet"), // equipped cosmetic; RLS-gated by level
  titleId: text("title_id").notNull().default("novice"), // equipped cosmetic; RLS-gated by level
  createdAt: timestamp("created_at").defaultNow(),
});

export const trackables = pgTable("trackables", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  kind: text("kind").notNull(), // 'habit' | 'task'
  goalType: text("goal_type").notNull().default("build"), // habits: 'build' (default) | 'reduce' (quit/cut-down); descriptive only
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  goalType: text("goal_type").notNull().default("build"), // habits: 'build' (default) | 'reduce' (quit/cut-down); descriptive only
  dueOn: date("due_on"), // tasks only: optional scheduled day; null = always due. Hidden until this date, then shows until done.
  difficulty: text("difficulty").notNull(), // 'easy' | 'medium' | 'hard'
  coinValue: integer("coin_value").notNull(),
  period: text("period"), // habits: 'day' (v1); 'week'|'month' (v2)
  dueOn: date("due_on"), // tasks only: optional scheduled day; null = always due. Hidden until this date, then shows until done.
  quota: integer("quota").notNull().default(1),
  weekdays: integer("weekdays").array(), // 0-6, for specific-weekday habits
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const completions = pgTable(
  "completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackableId: uuid("trackable_id").notNull().references(() => trackables.id),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    completedOn: date("completed_on").notNull(),
    xpEarned: integer("xp_earned").notNull(),
    coinsEarned: integer("coins_earned").notNull(),
    streakAfter: integer("streak_after").notNull(),
    freezeSpent: integer("freeze_spent").notNull().default(0),
    freezeGranted: integer("freeze_granted").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ oncePerDay: unique().on(t.trackableId, t.completedOn) })
);

export const coinLedger = pgTable("coin_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  delta: integer("delta").notNull(),
  kind: text("kind").notNull(), // 'earn' | 'redeem' | 'contribute'
  refId: uuid("ref_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const freezeTokens = pgTable("freeze_tokens", {
  userId: uuid("user_id").primaryKey().references(() => profiles.id),
  balance: integer("balance").notNull().default(0),
});

export const leagueStandings = pgTable(
  "league_standings",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id),
    week: date("week").notNull(), // Monday of the ISO week this row applies to
    tier: text("tier").notNull(), // 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
    xp: integer("xp").notNull().default(0), // backfilled once the week settles; 0 while current
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ onePerWeek: unique().on(t.userId, t.week) })
);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id").notNull().references(() => groups.id),
    userId: uuid("user_id").notNull().references(() => profiles.id),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => ({ onceMember: unique().on(t.groupId, t.userId) })
);

export const rewards = pgTable("rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // 'personal' | 'shared'
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  cost: integer("cost").notNull(),
  userId: uuid("user_id").references(() => profiles.id), // personal owner
  groupId: uuid("group_id").references(() => groups.id), // shared
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rewardContributions = pgTable("reward_contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  rewardId: uuid("reward_id").notNull().references(() => rewards.id),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
