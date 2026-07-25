import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useReminderTap } from "@/features/navigation/reminderTap";

/**
 * Deep-links a tapped reminder notification to the habit/task it was for,
 * instead of just opening the app to wherever it happened to be. The
 * notification's `identifier` is `${trackableId}:${slot}` (see
 * `schedule.ts`'s `req()`) — trackable ids are UUIDs (no colons), so
 * splitting on ":" and taking the first segment recovers it cleanly.
 * Stashes the id in a tiny global store and navigates to Today, which reads
 * and clears it once its trackable list is loaded to open that item's edit
 * panel. Registered once at the app root, independent of auth state — it's
 * inert (a no-op navigation) if nothing was ever scheduled.
 */
export function useNotificationTapHandler(): void {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const trackableId = response.notification.request.identifier.split(":")[0];
      if (!trackableId) return;
      useReminderTap.getState().setTrackableId(trackableId);
      router.push("/(tabs)");
    });
    return () => sub.remove();
  }, []);
}
