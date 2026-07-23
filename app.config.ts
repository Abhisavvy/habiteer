import { ExpoConfig } from "expo/config";
import { ConfigPlugin, withDangerousMod } from "expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

/**
 * The widget's header mark needs the real app icon as an ImageWidget — but
 * ImageWidget's require()-based path fetches over HTTP from Metro's dev
 * server on every render, which crashed intermittently
 * (`IllegalArgumentException: width and height must be > 0`, from a
 * transiently-failed fetch collapsing the native ImageView's measured size).
 * A plain Android drawable resource decodes synchronously with no network
 * involved, so this copies the icon into res/drawable/ on every prebuild
 * rather than relying on a one-off manual copy that `expo prebuild` would
 * silently wipe (android/ is gitignored, regenerated each time).
 */
const withWidgetIconResource: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const destDir = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/drawable");
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(
        path.join(config.modRequest.projectRoot, "assets/icon.png"),
        path.join(destDir, "widget_icon.png")
      );
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
        ],
      },
    ],
    // Expo CLI accepts an inline plugin function at runtime; ExpoConfig's own
    // type only declares string/tuple entries, so this needs a cast.
    withWidgetIconResource as unknown as string,
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};
export default config;
