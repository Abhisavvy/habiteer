/** Providers this app has a sign-in button for. */
export type ExternalProvider = "google";

/**
 * Whether `provider` is enabled, read out of GoTrue's `/auth/v1/settings`
 * payload.
 *
 * **Fails OPEN on purpose.** This gate only ever hides a button, so an
 * unreadable answer must not read as "disabled" — hiding working sign-in is a
 * worse failure than showing one that errors, and the error path already
 * reports itself. Only an explicit `false` hides anything.
 */
export function isProviderEnabled(settings: unknown, provider: ExternalProvider): boolean {
  const external = (settings as { external?: Record<string, unknown> } | null)?.external;
  if (!external || typeof external !== "object") return true;
  const flag = external[provider];
  return typeof flag === "boolean" ? flag : true;
}

/**
 * Asks the project which external providers are actually configured.
 *
 * The app previously showed "Continue with Google" unconditionally, so on a
 * project without the provider set up the button was guaranteed to fail — the
 * worst kind of first impression, and exactly what happened after the backend
 * was rebuilt. Probing means the button tracks the project rather than a
 * hardcoded assumption: enable Google in the dashboard and it comes back on its
 * own, with no release.
 *
 * `/auth/v1/settings` needs only the anon key and returns a small payload, so
 * this is one cheap request, on the sign-in screen only. Deliberately does NOT
 * import the supabase client: this file is unit-tested, and pulling the client
 * in would drag SecureStore and the URL polyfill into a node test environment.
 */
export async function fetchEnabledProviders(): Promise<unknown> {
  try {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY! },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null; // offline — isProviderEnabled fails open, so the button stays
  }
}
