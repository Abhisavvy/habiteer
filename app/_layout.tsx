import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { Stack, Redirect, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "@/features/auth/useAuth";
import { fontsToLoad } from "@/constants/fonts";
import { AppSplash } from "@/components/AppSplash";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { session, ready, init } = useAuth();
  const segments = useSegments();
  const [queryClient] = useState(() => new QueryClient());
  const [fontsLoaded] = useFonts(fontsToLoad);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => init(), []);

  // Load persisted sound/haptics preferences into the feedback module's cache
  // once, so playback checks stay synchronous on the completion hot path.
  useEffect(() => {
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
        <Stack screenOptions={{ headerShown: false }} />
      )}
      {!splashDone && <AppSplash onDone={() => setSplashDone(true)} />}
    </QueryClientProvider>
  );
}
