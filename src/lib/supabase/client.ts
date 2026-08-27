import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

/** SecureStore adapter so Supabase sessions persist encrypted on-device. */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/**
 * Read straight from the env vars, NOT from `Constants.expoConfig.extra`.
 *
 * Metro inlines `EXPO_PUBLIC_*` into the JS bundle at transform time, so
 * changing .env and restarting Metro is enough. `extra` is populated by
 * app.config.ts and then baked into the NATIVE app at build time, which meant
 * pointing the app at a different Supabase project needed a full
 * `expo run:android` — and until you did, the bundle carried the new URL while
 * the running app still called the old one. The only symptom was
 * "Network request failed", which looks nothing like a stale-config problem.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup rather than surfacing as an opaque network error on
  // the first request.
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Check .env, then restart Metro."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
