import { useEffect } from "react";
import { Stack, Redirect, useSegments } from "expo-router";
import { useAuth } from "@/features/auth/useAuth";

export default function RootLayout() {
  const { session, ready, init } = useAuth();
  const segments = useSegments();

  useEffect(() => init(), []);
  if (!ready) return null;

  const inAuthGroup = segments[0] === "(auth)";
  if (!session && !inAuthGroup) return <Redirect href="/(auth)/sign-in" />;
  if (session && inAuthGroup) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
