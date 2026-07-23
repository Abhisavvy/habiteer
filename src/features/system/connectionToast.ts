import { create } from "zustand";

/**
 * A tiny global store for the connection/"not saved" indicator. TanStack
 * Query's query/mutation caches push a message here on a network failure (see
 * app/_layout.tsx); the global <ConnectionToast /> renders whatever's set.
 */
interface ConnectionToastState {
  message: string | null;
  show: (message: string) => void;
  clear: () => void;
}

export const useConnectionToast = create<ConnectionToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}));
