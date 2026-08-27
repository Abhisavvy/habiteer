import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

interface AuthState {
  session: Session | null;
  ready: boolean;
  init: () => void;
  signOut: () => Promise<void>;
}

/** Tracks the Supabase session; persists across app launches and devices. */
export const useAuth = create<AuthState>((set) => ({
  session: null,
  ready: false,
  init: () => {
    supabase.auth
      .getSession()
      .then(({ data }) => set({ session: data.session, ready: true }))
      // `ready` gates SplashScreen.hideAsync() in app/_layout.tsx, so a
      // rejection here left the native splash up permanently — no error, no
      // retry, force-quit the only way out. getSession() usually resolves with
      // an `error` field rather than throwing, but it can reject outright when
      // the token needs a network refresh and there's nothing to reach
      // (offline, or a paused backend). Landing on sign-in is the honest state
      // when we genuinely can't confirm a session, and onAuthStateChange still
      // fills it in if things recover.
      .catch(() => set({ session: null, ready: true }));
    supabase.auth.onAuthStateChange((_e, session) => set({ session }));
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null });
  },
}));
