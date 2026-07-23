import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Trackable } from "@/features/trackables/api";
import { notificationRequestsFor, type ReminderTrigger } from "./schedule";

const ANDROID_CHANNEL_ID = "habit-reminders";
/** Master on/off, mirrored to the Profile "Reminders" toggle. Defaults ON. */
export const REMINDERS_ENABLED_KEY = "settings.remindersEnabled";

/** Read the master toggle (defaults to enabled when never set). */
export async function remindersEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(REMINDERS_ENABLED_KEY);
  return v === null ? true : v === "1";
}

export async function setRemindersEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_ENABLED_KEY, on ? "1" : "0");
}

/** Ask for notification permission; on Android also create the reminders channel. Returns granted. */
export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Habit reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Cancel every scheduled reminder — used when the master toggle is switched off. */
export async function disableReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Map a pure trigger descriptor onto expo's SchedulableTriggerInput. */
function toExpoTrigger(trigger: ReminderTrigger): Notifications.NotificationTriggerInput {
  const channelId = Platform.OS === "android" ? ANDROID_CHANNEL_ID : undefined;
  switch (trigger.type) {
    case "daily":
      return {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: trigger.hour,
        minute: trigger.minute,
        channelId,
      };
    case "weekly":
      return {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: trigger.weekday,
        hour: trigger.hour,
        minute: trigger.minute,
        channelId,
      };
    case "date":
      return {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(trigger.date),
        channelId,
      };
  }
}

/**
 * Full cancel-and-reschedule of every habit/task reminder from the current
 * trackable list. A full resync (rather than diffing) keeps device state from
 * drifting out of sync with the DB after edits, archives, or reinstalls.
 * No-ops to "cancel everything" when the master toggle is off or permission
 * is denied. Safe to call on every foreground / trackables change.
 */
export async function syncReminders(trackables: Trackable[]): Promise<void> {
  // Always start clean so removed/edited reminders don't linger.
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!(await remindersEnabled())) return;

  const requests = trackables
    .filter((t) => t.archivedAt === null && t.reminderTime)
    .flatMap((t) => notificationRequestsFor(t));
  if (requests.length === 0) return;

  if (!(await requestReminderPermission())) return;

  await Promise.all(
    requests.map((r) =>
      Notifications.scheduleNotificationAsync({
        identifier: r.identifier,
        content: { title: r.title, body: r.body },
        trigger: toExpoTrigger(r.trigger),
      })
    )
  );
}
