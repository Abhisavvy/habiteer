import { create } from "zustand";

/**
 * Set when a reminder notification is tapped, carrying the trackable id
 * whose reminder fired (see `useNotificationTapHandler`). Today's screen
 * reads and clears it once its trackable list is loaded, to open that
 * item's edit panel — same "a tiny global read on the consuming screen"
 * shape `addAction.ts` already established for the raised "+" button.
 */
interface ReminderTapState {
  trackableId: string | null;
  setTrackableId: (id: string | null) => void;
}

export const useReminderTap = create<ReminderTapState>((set) => ({
  trackableId: null,
  setTrackableId: (id) => set({ trackableId: id }),
}));
