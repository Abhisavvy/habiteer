import { pgTable, uuid, text, integer, timestamp, date, unique } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // == auth.users.id
  displayName: text("display_name").notNull(),
  avatar: text("avatar").notNull(), // vestigial (set to '' at signup, never rendered — client draws initial-letter avatars)
  avatarColor: text("avatar_color").notNull().default("violet"), // equipped cosmetic; RLS-gated by level
  titleId: text("title_id").notNull().default("novice"), // equipped cosmetic; RLS-gated by level
  cardSkin: text("card_skin").notNull().default("plain"), // equipped account-wide card skin; RLS-gated by level
  createdAt: timestamp("created_at").defaultNow(),
});

export const trackables = pgTable("trackables", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  kind: text("kind").notNull(), // 'habit' | 'task'
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  difficulty: text("difficulty").notNull(), // 'easy' | 'medium' | 'hard'
  coinValue: integer("coin_value").notNull(),
  goalType: text("goal_type").notNull().default("build"), // habits: 'build' (default) | 'reduce' (quit/cut-down); descriptive only
  period: text("period"), // habits: 'day' (v1); 'week'|'month' (v2)
  quota: integer("quota").notNull().default(1),
  weekdays: integer("weekdays").array(), // 0-6, for specific-weekday habits
  dueOn: date("due_on"), // tasks only: optional scheduled day; null = always due. Hidden until this date, then shows until done.
  reminderTime: text("reminder_time"), // optional local-notification time "HH:MM" (24h); null = no reminder. Descriptive, gates nothing.
  why: text("why"), // optional one-line "why this matters to me", shown back when momentum is lost. Descriptive, gates nothing.
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

export const questClaims = pgTable(
  "quest_claims",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id),
    questId: text("quest_id").notNull(), // matches a QUESTS[].id in gamification/constants.ts
    week: date("week").notNull(), // Monday of the ISO week the quest was claimed for
    reward: integer("reward").notNull(), // coins credited (snapshot of the def's reward at claim time)
    claimedAt: timestamp("claimed_at").defaultNow(),
  },
  (t) => ({ oncePerWeek: unique().on(t.userId, t.questId, t.week) })
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

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  trackableId: uuid("trackable_id").notNull().references(() => trackables.id),
  targetCount: integer("target_count").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(), // inclusive
  createdAt: timestamp("created_at").defaultNow(),
});
// CHECK (ends_on >= starts_on), CHECK (target_count > 0), and a btree_gist
// EXCLUDE constraint preventing two goals on the same trackable from having
// overlapping [starts_on, ends_on] windows are applied via rls.sql (not
// expressible in drizzle's schema DSL) — see rls.sql's "goals" section.

export const rewardContributions = pgTable("reward_contributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  rewardId: uuid("reward_id").notNull().references(() => rewards.id),
  userId: uuid("user_id").notNull().references(() => profiles.id),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
