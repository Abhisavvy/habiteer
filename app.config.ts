import { ExpoConfig } from "expo/config";
import { ConfigPlugin, withDangerousMod } from "expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

/**
 * Copies the widget suite's pre-baked textures (halftone card fill, the
 * Daily-strip banner's dot overlay) into res/drawable/ as plain Android
 * drawable resources — these decode synchronously via
 * `BitmapFactory.decodeResource`, unlike `ImageWidget`'s `require()` path,
 * which fetches over HTTP from Metro's dev server on every render and
 * crashed intermittently (`IllegalArgumentException: width and height
 * must be > 0`, from a transiently-failed fetch collapsing the native
 * ImageView's measured size).
 *
 * It also copies three Google Fonts TTFs into android assets/fonts/ so the
 * widget's TextWidgets can set a real `fontFamily` — react-native-android-
 * widget's native TextWidget resolves `fontFamily` by looking for a file
 * named "<fontFamily>.<ext>" in that exact folder (see its ResourceUtils
 * .loadTypeface), separate from expo-font's runtime-only JS font registry
 * that every other screen uses. Without this the widget's "TODAY" header
 * silently falls back to the system font.
 *
 * Neither survives a bare `expo prebuild` re-run on its own (android/ is
 * gitignored and regenerated each time), hence the plugin.
 */
const WIDGET_FONTS: Record<string, string> = {
  "Bangers.ttf": "node_modules/@expo-google-fonts/bangers/400Regular/Bangers_400Regular.ttf",
  "SpaceMono700.ttf": "node_modules/@expo-google-fonts/space-mono/700Bold/SpaceMono_700Bold.ttf",
  "SpaceGrotesk700.ttf": "node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf",
};

const withWidgetAssets: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.projectRoot;
      const androidRoot = config.modRequest.platformProjectRoot;

      const drawableDir = path.join(androidRoot, "app/src/main/res/drawable");
      fs.mkdirSync(drawableDir, { recursive: true });
      // Halftone-textured card fill + the Daily-strip banner's dot overlay
      // (see scripts/gen-widget-halftone.js) — pre-baked because SvgWidget's
      // ImageView never sets a ScaleType (so it defaults to letterboxing a
      // non-square SVG instead of filling the card), while ImageWidget's
      // resizeMode="stretch" genuinely fills any aspect ratio. Android
      // drawable resource names must be lowercase snake_case, hence the
      // rename on copy. (The app's own H-icon is no longer used inside any
      // widget — every widget's icon tile now shows Ember's own silhouette,
      // rendered live via SvgWidget — so there's no icon PNG to copy here.)
      fs.copyFileSync(
        path.join(root, "assets/widget-halftone-light.png"),
        path.join(drawableDir, "widget_halftone_light.png")
      );
      fs.copyFileSync(
        path.join(root, "assets/widget-halftone-dark.png"),
        path.join(drawableDir, "widget_halftone_dark.png")
      );
      fs.copyFileSync(
        path.join(root, "assets/widget-banner-dots.png"),
        path.join(drawableDir, "widget_banner_dots.png")
      );
      fs.copyFileSync(
        path.join(root, "assets/widget-starburst-light.png"),
        path.join(drawableDir, "widget_starburst_light.png")
      );
      fs.copyFileSync(
        path.join(root, "assets/widget-starburst-dark.png"),
        path.join(drawableDir, "widget_starburst_dark.png")
      );

      const fontsDir = path.join(androidRoot, "app/src/main/assets/fonts");
      fs.mkdirSync(fontsDir, { recursive: true });
      for (const [destName, srcRelPath] of Object.entries(WIDGET_FONTS)) {
        fs.copyFileSync(path.join(root, srcRelPath), path.join(fontsDir, destName));
      }

      return config;
    },
  ]);

/**
 * Expo config. The Android home-screen widget (v2) is added here via the
 * react-native-android-widget config plugin once Phase 6 begins.
 */
const config: ExpoConfig = {
  name: "Habiteer",
  slug: "habiteer",
  scheme: "habiteer", // deep-link scheme for OAuth redirect
  icon: "./assets/icon.png",
  android: {
    package: "com.habiteer.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon-foreground.png",
      backgroundImage: "./assets/adaptive-icon-background.png",
      monochromeImage: "./assets/adaptive-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "expo-audio",
    [
      "expo-notifications",
      {
        // Small monochrome status-bar icon + tint for habit reminders. Reuses
        // the adaptive-icon monochrome layer (already a white-on-transparent
        // glyph, exactly what Android's notification icon spec wants).
        icon: "./assets/adaptive-icon-monochrome.png",
        color: "#7B5CFF",
      },
    ],
    [
      "expo-splash-screen",
      {
        // Native pre-JS splash — shown for the instant before the custom
        // AppSplash (app/_layout.tsx) mounts and takes over the animation.
        // No plugin was configured before, so this screen was showing
        // Expo's generic default rather than the app icon.
        image: "./assets/icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#7B5CFF",
      },
    ],
    [
      "react-native-android-widget",
      {
        widgets: [
          {
            name: "HabitWidget",
            label: "Habiteer",
            description: "Today's habits and tasks, one tap from your home screen.",
            minWidth: "180dp",
            minHeight: "110dp",
            targetCellWidth: 3,
            targetCellHeight: 2,
            maxResizeWidth: "300dp",
            maxResizeHeight: "300dp",
            resizeMode: "horizontal|vertical",
            previewImage: "./assets/widget-preview.png",
            updatePeriodMillis: 1800000,
          },
          {
            // P2 "07 Widget suite · Daily strip 4×4" — the expanded
            // checklist: a violet header banner with an embedded level-
            // progress bar, plus a per-row coin payout below. The
            // registered `name` stays `TodayWidgetExpanded` (matching
            // taskHandler.tsx's WIDGET_NAMES.TODAY_EXPANDED) even though
            // the mock renamed this widget — changing it would orphan any
            // instance already placed on a user's home screen.
            name: "TodayWidgetExpanded",
            label: "Habiteer — Daily strip",
            description: "Today's habits with your level progress and coin payouts.",
            minWidth: "250dp",
            minHeight: "250dp",
            targetCellWidth: 4,
            targetCellHeight: 4,
            maxResizeWidth: "400dp",
            maxResizeHeight: "400dp",
            resizeMode: "horizontal|vertical",
            previewImage: "./assets/widget-preview-today-expanded.png",
            updatePeriodMillis: 1800000,
          },
          {
            // P2 "07 Widget suite · Companion 2×2" — Ember's portrait,
            // level, and streak. Static content; no row-level clicks.
            name: "CompanionWidget",
            label: "Habiteer — Companion",
            description: "Ember, your level, and your current streak.",
            minWidth: "110dp",
            minHeight: "110dp",
            targetCellWidth: 2,
            targetCellHeight: 2,
            maxResizeWidth: "250dp",
            maxResizeHeight: "250dp",
            resizeMode: "horizontal|vertical",
            previewImage: "./assets/widget-preview-companion.png",
            updatePeriodMillis: 1800000,
          },
          {
            // Streak 2×2 — off the current P2 mock (replaced there by
            // Combo + Quest below), kept registered so the instance
            // already placed on a home screen doesn't break.
            name: "StreakWidget",
            label: "Habiteer — Streak",
            description: "Your current streak, big and glanceable.",
            minWidth: "110dp",
            minHeight: "110dp",
            targetCellWidth: 2,
            targetCellHeight: 2,
            maxResizeWidth: "250dp",
            maxResizeHeight: "250dp",
            resizeMode: "horizontal|vertical",
            previewImage: "./assets/widget-preview-streak.png",
            updatePeriodMillis: 1800000,
          },
          {
            // P2 "07 Widget suite · Combo 2×2" — the streak combo
            // multiplier as a starburst badge. New this round.
            name: "ComboWidget",
            label: "Habiteer — Combo",
            description: "Your current streak combo multiplier.",
            minWidth: "110dp",
            minHeight: "110dp",
            targetCellWidth: 2,
            targetCellHeight: 2,
            maxResizeWidth: "250dp",
            maxResizeHeight: "250dp",
            resizeMode: "horizontal|vertical",
            previewImage: "./assets/widget-preview-combo.png",
            updatePeriodMillis: 1800000,
          },
          {
            // P2 "07 Widget suite · Quest 4×2" — today's due-count framed
            // as a quest, with a reward preview. New this round.
            name: "QuestWidget",
            label: "Habiteer — Quest",
            description: "Today's quest — complete every habit due today.",
            minWidth: "180dp",
            minHeight: "110dp",
            targetCellWidth: 4,
            targetCellHeight: 2,
            maxResizeWidth: "300dp",
            maxResizeHeight: "250dp",
            resizeMode: "horizontal|vertical",
            previewImage: "./assets/widget-preview-quest.png",
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
    // Expo CLI accepts an inline plugin function at runtime; ExpoConfig's own
    // type only declares string/tuple entries, so this needs a cast.
    withWidgetAssets as unknown as string,
  ],
};
export default config;
