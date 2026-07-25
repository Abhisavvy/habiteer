import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { Stack, Redirect, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache, focusManager } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/features/auth/useAuth";
import { fontsToLoad } from "@/constants/fonts";
import { AppSplash } from "@/components/AppSplash";
import { loadFeedbackSettings } from "@/features/feedback/feedback";
import { ConnectionToast } from "@/components/ConnectionToast";
import { isConnectionError } from "@/features/system/connection";
import { useConnectionToast } from "@/features/system/connectionToast";
import { useTrackablesQuery } from "@/features/trackables/useTrackables";
import { useReminderSync } from "@/features/reminders/useReminderSync";
import { useNotificationTapHandler } from "@/features/reminders/useNotificationTap";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Habit reminders should still pop a banner/sound if the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// A session that never happens to land on Today used to never resync its
// reminders — mounted here instead, gated on `session` so it never fetches
// trackables (or schedules anything) while signed out.
function ReminderSyncMount() {
  const { data: trackables } = useTrackablesQuery();
  useReminderSync(trackables);
  return null;
}

export default function RootLayout() {
  const { session, ready, init } = useAuth();
  const segments = useSegments();
  useNotificationTapHandler();
  // A dropped/unreachable server surfaces as a global "not saved" banner
  // (see ConnectionToast). Only network-flavored failures trigger it, so
  // ordinary validation/business errors stay on their own specific handlers.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (err) => {
            if (isConnectionError(err))
              useConnectionToast.getState().show("Can't reach the server — showing your last saved data.");
          },
        }),
        mutationCache: new MutationCache({
          onError: (err) => {
            if (isConnectionError(err))
              useConnectionToast.getState().show("Couldn't save — you're offline. Check your connection and try again.");
          },
        }),
      })
  );
  const [fontsLoaded] = useFonts(fontsToLoad);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => init(), []);

  // Load persisted sound/haptics preferences into the feedback module's cache
  // once, so playback checks stay synchronous on the completion hot path.
  useEffect(() => {
    void loadFeedbackSettings();
  }, []);

  // Refetch queries when the app returns to the foreground — so a habit left
  // "done" overnight resets once today() rolls to the new UTC day (the day
  // reset relies on completions being re-fetched, not just re-rendered).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      if (Platform.OS !== "web") focusManager.setFocused(status === "active");
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (ready && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontsLoaded]);

  if (!ready || !fontsLoaded) return null;

  const inAuthGroup = segments[0] === "(auth)";

  return (
    <QueryClientProvider client={queryClient}>
      {!session && !inAuthGroup ? (
        <Redirect href="/(auth)/sign-in" />
      ) : session && inAuthGroup ? (
        <Redirect href="/(tabs)" />
      ) : (
        // Android-only per react-navigation's own docs (resolves to that
        // platform's default on iOS anyway) — makes the stack's push/pop
        // transition an explicit choice instead of an unstated "default".
        // `animationDuration` isn't usable here: react-navigation documents
        // it as iOS-only, and not for "default"/Android-specific animations
        // like this one — Android's transition duration isn't independently
        // tunable through this API, stated rather than faked.
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
      )}
      {!splashDone && <AppSplash onDone={() => setSplashDone(true)} />}
      {session && <ReminderSyncMount />}
      <ConnectionToast />
    </QueryClientProvider>
  );
}
