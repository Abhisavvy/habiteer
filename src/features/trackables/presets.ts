import { DIFFICULTY_BASE, type Difficulty } from "@/features/gamification/constants";
import type { TrackableFormValues } from "./schemas";

export type StarterHabit = {
  name: string;
  emoji: string;
  difficulty: Difficulty;
  goalType: "build" | "reduce";
};

/**
 * One-tap starter habits for a brand-new account.
 *
 * A new account previously landed on an empty screen whose only route forward
 * was a form asking for a name, an emoji, a difficulty, a schedule, a goal
 * direction and a reminder — six decisions before the first completion. These
 * exist so the first action is a single tap, and so the empty state teaches the
 * app's shape (difficulties differ, habits can be broken as well as built)
 * rather than just demanding input.
 *
 * Deliberately kept to six. Enough to find something that fits, few enough to
 * scan; a wall of twenty presets is its own kind of decision paralysis.
 *
 * Payouts are NOT written here — `presetToFormValues` derives them from
 * `DIFFICULTY_BASE`, so a preset can never drift from the economy every
 * hand-made habit uses. There's a test pinning exactly that.
 */
export const STARTER_HABITS: StarterHabit[] = [
  { name: "Drink water", emoji: "💧", difficulty: "easy", goalType: "build" },
  { name: "Walk 20 minutes", emoji: "🚶", difficulty: "easy", goalType: "build" },
  { name: "Read 10 pages", emoji: "📖", difficulty: "easy", goalType: "build" },
  { name: "Meditate", emoji: "🧘", difficulty: "medium", goalType: "build" },
  { name: "Exercise", emoji: "🏋️", difficulty: "hard", goalType: "build" },
  // The one 'reduce' preset. Break-a-habit mode is otherwise buried in the add
  // form's Goal control with nothing announcing that it exists.
  { name: "No late-night scrolling", emoji: "📱", difficulty: "medium", goalType: "reduce" },
];

/**
 * Expands a preset into the same form values the add panel would submit.
 *
 * Every field a hand-made habit gets is set explicitly — a starter habit is a
 * pre-filled form, not a special kind of row, so nothing downstream needs to
 * know it came from a preset. Daily with quota 1 so it is due the moment it is
 * created; an account that adds a starter habit and still sees an empty day
 * would defeat the point. No reminder, since asking for notification permission
 * on someone's first tap is the wrong trade.
 */
export function presetToFormValues(preset: StarterHabit): TrackableFormValues {
  return {
    kind: "habit",
    name: preset.name,
    emoji: preset.emoji,
    difficulty: preset.difficulty,
    coinValue: DIFFICULTY_BASE[preset.difficulty],
    goalType: preset.goalType,
    period: "day",
    quota: 1,
    weekdays: null,
    dueOn: null,
    reminderTime: null,
    why: null,
  };
}
