import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { SpaceMono_700Bold } from "@expo-google-fonts/space-mono";

/** Font family name strings for use in StyleSheet `fontFamily`. Loaded via `useFonts` in app/_layout.tsx. */
export const fonts = {
  display700: "SpaceGrotesk_700Bold", // headings, wordmark
  display600: "SpaceGrotesk_600SemiBold", // card titles, tab labels
  mono700: "SpaceMono_700Bold", // every number: XP, coins, streaks
} as const;

/** Passed to `useFonts` — keys must match the family names referenced above. */
export const fontsToLoad = {
  SpaceGrotesk_700Bold,
  SpaceGrotesk_600SemiBold,
  SpaceMono_700Bold,
};
