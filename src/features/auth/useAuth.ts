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
    supabase.auth.getSession().then(({ data }) => set({ session: data.session, ready: true }));
    supabase.auth.onAuthStateChange((_e, session) => set({ session }));
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null });
  },
}));
