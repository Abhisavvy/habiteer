import { useEffect, useState } from "react";
import { Stack, Redirect, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/useAuth";

export default function RootLayout() {
  const { session, ready, init } = useAuth();
  const segments = useSegments();
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => init(), []);
  if (!ready) return null;

  const inAuthGroup = segments[0] === "(auth)";
  if (!session && !inAuthGroup) return <Redirect href="/(auth)/sign-in" />;
  if (session && inAuthGroup) return <Redirect href="/" />;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
