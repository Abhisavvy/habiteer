import { Bangers_400Regular } from "@expo-google-fonts/bangers";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { SpaceMono_700Bold } from "@expo-google-fonts/space-mono";

/**
 * Font family names for StyleSheet `fontFamily`. Comic-RPG "Action Panel"
 * pairing (P2): Bangers for display/headings/wordmark, Space Grotesk for
 * titles + body, Space Mono for every number. Loaded via `useFonts` in
 * app/_layout.tsx (runtime-bundled — no native rebuild needed).
 */
export const fonts = {
  heading: "Bangers_400Regular", // big comic headings, wordmark, stamps ("POW" energy)
  display700: "SpaceGrotesk_700Bold", // strong titles / body-bold
  display600: "SpaceGrotesk_600SemiBold", // card titles, tab labels, body
  mono700: "SpaceMono_700Bold", // every number: XP, coins, streaks
} as const;

/** Passed to `useFonts` — keys must match the family names referenced above. */
export const fontsToLoad = {
  Bangers_400Regular,
  SpaceGrotesk_700Bold,
  SpaceGrotesk_600SemiBold,
  SpaceMono_700Bold,
};
