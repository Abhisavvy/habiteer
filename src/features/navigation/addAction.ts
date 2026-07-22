import { create } from "zustand";

/**
 * Lets the floating "+" button in BottomHUD — which lives outside any one
 * screen — trigger whichever screen is currently focused. Each screen
 * registers its own "open add panel" callback on focus and clears it on
 * blur; screens with nothing to add (Board, Profile) simply never register
 * one, and the button hides itself when there's no handler.
 */
interface AddActionState {
  handler: (() => void) | null;
  setHandler: (fn: (() => void) | null) => void;
  trigger: () => void;
}

export const useAddAction = create<AddActionState>((set, get) => ({
  handler: null,
  setHandler: (fn) => set({ handler: fn }),
  trigger: () => get().handler?.(),
}));
