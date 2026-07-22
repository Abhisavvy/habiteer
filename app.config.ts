import { ExpoConfig } from "expo/config";

/**
 * Expo config. The Android home-screen widget (v2) is added here via the
 * react-native-android-widget config plugin once Phase 6 begins.
 */
const config: ExpoConfig = {
  name: "Habiteer",
  slug: "habiteer",
  scheme: "habiteer", // deep-link scheme for OAuth redirect
  android: { package: "com.habiteer.app" },
  plugins: [
    "expo-router",
    "expo-secure-store",
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
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};
export default config;
