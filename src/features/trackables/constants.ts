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
