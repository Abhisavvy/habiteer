import { theme } from "@/constants/theme";
import {
  AVATAR_COLOR_LEVELS,
  TITLE_LEVELS,
  CARD_SKIN_LEVELS,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_CARD_SKIN,
} from "@/features/gamification/constants";

/** Client-only visual catalog for cosmetics. Unlock levels come from the
 * shared, SQL-mirrored maps in gamification/constants.ts (the game rule); the
 * hex/textColor/label here are pure presentation. `textColor` is per-swatch
 * because the avatar draws a white initial by default and yellow needs ink
 * for legibility — same pairing the leaderboard tier badge already uses. */
export type AvatarColor = { id: string; level: number; hex: string; textColor: string };
export type Title = { id: string; level: number; label: string };

export const AVATAR_COLORS: AvatarColor[] = [
  { id: "violet", level: AVATAR_COLOR_LEVELS.violet, hex: theme.color.violet, textColor: "#fff" },
  { id: "jade", level: AVATAR_COLOR_LEVELS.jade, hex: theme.color.jade, textColor: "#fff" },
  { id: "fire", level: AVATAR_COLOR_LEVELS.fire, hex: theme.color.fire, textColor: "#fff" },
  { id: "yellow", level: AVATAR_COLOR_LEVELS.yellow, hex: theme.color.yellow, textColor: theme.color.ink },
  { id: "ink", level: AVATAR_COLOR_LEVELS.ink, hex: theme.color.ink, textColor: "#fff" },
];

export const TITLES: Title[] = [
  { id: "novice", level: TITLE_LEVELS.novice, label: "Habit Novice" },
  { id: "builder", level: TITLE_LEVELS.builder, label: "Habit Builder" },
  { id: "master", level: TITLE_LEVELS.master, label: "Habit Master" },
  { id: "legend", level: TITLE_LEVELS.legend, label: "Habit Legend" },
];

/** Account-wide card skins — all deliberately LIGHT tints so the card's
 * existing ink text stays readable (no per-skin text-color refactor). */
export type CardSkin = { id: string; level: number; bg: string; label: string };
export const CARD_SKINS: CardSkin[] = [
  { id: "plain", level: CARD_SKIN_LEVELS.plain, bg: "#FFFFFF", label: "Plain" },
  { id: "cream", level: CARD_SKIN_LEVELS.cream, bg: "#FFF6E0", label: "Cream" },
  { id: "mint", level: CARD_SKIN_LEVELS.mint, bg: "#E4F7EF", label: "Mint" },
  { id: "lavender", level: CARD_SKIN_LEVELS.lavender, bg: "#EDE7FF", label: "Lavender" },
  { id: "peach", level: CARD_SKIN_LEVELS.peach, bg: "#FFE9DE", label: "Peach" },
];

const AVATAR_BY_ID = new Map(AVATAR_COLORS.map((c) => [c.id, c]));
const TITLE_BY_ID = new Map(TITLES.map((t) => [t.id, t]));
const CARD_SKIN_BY_ID = new Map(CARD_SKINS.map((s) => [s.id, s]));

/** Resolve an equipped avatar-color id to its swatch, falling back to the
 * default if the stored id is somehow unrecognized (defensive — the RLS gate
 * should never let an unknown id be stored). */
export function avatarColorFor(id: string | null | undefined): AvatarColor {
  return AVATAR_BY_ID.get(id ?? DEFAULT_AVATAR_COLOR) ?? AVATAR_BY_ID.get(DEFAULT_AVATAR_COLOR)!;
}

export function titleFor(id: string | null | undefined): Title | null {
  return TITLE_BY_ID.get(id ?? "") ?? null;
}

export function cardSkinFor(id: string | null | undefined): CardSkin {
  return CARD_SKIN_BY_ID.get(id ?? DEFAULT_CARD_SKIN) ?? CARD_SKIN_BY_ID.get(DEFAULT_CARD_SKIN)!;
}
