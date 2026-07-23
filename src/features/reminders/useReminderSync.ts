import { useEffect } from "react";
import { AppState } from "react-native";
import type { Trackable } from "@/features/trackables/api";
import { syncReminders } from "./scheduler";

/**
 * Keeps the OS's scheduled local notifications in lockstep with the current
 * trackable list. Re-syncs whenever the list changes and again on foreground
 * (in case reminders were toggled or permission changed while backgrounded).
 * Fire-and-forget — scheduling failures never surface to the UI.
 */
export function useReminderSync(trackables: Trackable[] | undefined): void {
  useEffect(() => {
    if (!trackables) return;
    void syncReminders(trackables);
  }, [trackables]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active" && trackables) void syncReminders(trackables);
    });
    return () => sub.remove();
  }, [trackables]);
}
