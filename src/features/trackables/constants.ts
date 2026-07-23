import { theme } from "@/constants/theme";
import type { Difficulty } from "@/features/gamification/constants";

/** Exact values pulled from the design deliverable's DOM — the difficulty
 * pill uses the full color, several other spots (emoji box, selected icon
 * swatch) use a separate light tint of the same hue. Shared between
 * TrackableCard and TrackablePanel so they can't drift apart. */
export const DIFF_TINT: Record<Difficulty, string> = {
  easy: theme.color.jade,
  medium: theme.color.yellow,
  hard: theme.color.fire,
};

export const DIFF_LIGHT_TINT: Record<Difficulty, string> = {
  easy: "#D8F5EC",
  medium: "#FFF3C7",
  hard: "#FFDBD1",
};

export const LIGHT_VIOLET = "#EDE7FF";

/** Copy/emoji that reframe a card for a "reduce" (quit/cut-down) habit vs a
 * normal "build" one — a reduce habit reuses the whole completion/streak
 * engine, so only presentation differs. 🔥 "on fire" reads oddly for
 * quitting, so a reduce streak uses 🛡️ (a protected/clean streak). */
export function reductionFraming(goalType: "build" | "reduce"): {
  doneStamp: string;
  streakEmoji: string;
  pill: string | null;
} {
  return goalType === "reduce"
    ? { doneStamp: "RESISTED ✓", streakEmoji: "🛡️", pill: "REDUCE" }
    : { doneStamp: "DONE ✓", streakEmoji: "🔥", pill: null };
}
