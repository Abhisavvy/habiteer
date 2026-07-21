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
  plugins: ["expo-router", "expo-secure-store"],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
};
export default config;
