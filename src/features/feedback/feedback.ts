import * as Haptics from "expo-haptics";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Sound + haptic feedback for the reward moments (complete / redeem / level-up).
 * Both channels are gated by the user's Profile toggles, whose values are
 * cached in module scope (refreshed via `loadFeedbackSettings`) so the check
 * on the completion hot path stays synchronous — no `await AsyncStorage` in
 * the tap handler. All playback is fire-and-forget and never throws upward.
 */

let soundEnabled = true;
let hapticsEnabled = true;

/** Re-read the persisted toggles into the cache. Call at app init and whenever a toggle flips. */
export async function loadFeedbackSettings(): Promise<void> {
  try {
    const [s, h] = await Promise.all([
      AsyncStorage.getItem("settings.sound"),
      AsyncStorage.getItem("settings.haptics"),
    ]);
    soundEnabled = s === null ? true : s === "1";
    hapticsEnabled = h === null ? true : h === "1";
  } catch {
    // leave cache at its defaults
  }
}

/** Update the cache immediately when a Profile toggle flips (avoids an AsyncStorage read-back race). */
export function setFeedbackSetting(kind: "sound" | "haptics", on: boolean): void {
  if (kind === "sound") soundEnabled = on;
  else hapticsEnabled = on;
}

const SOURCES = {
  complete: require("../../../assets/sfx/complete.wav"),
  redeem: require("../../../assets/sfx/redeem.wav"),
  levelup: require("../../../assets/sfx/levelup.wav"),
} as const;
type CueName = keyof typeof SOURCES;

// Players are created lazily on first use (avoids touching the native audio
// module before the app is running) and reused thereafter.
const players: Partial<Record<CueName, AudioPlayer>> = {};

function play(name: CueName): void {
  if (!soundEnabled) return;
  try {
    let player = players[name];
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      players[name] = player;
    }
    player.seekTo(0);
    player.play();
  } catch {
    // ignore playback failures — feedback is non-essential
  }
}

function haptic(fn: () => Promise<void>): void {
  if (!hapticsEnabled) return;
  fn().catch(() => {});
}

/** Habit/task completed. */
export function feedbackComplete(): void {
  haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  play("complete");
}

/** Reward redeemed. */
export function feedbackRedeem(): void {
  haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  play("redeem");
}

/** Level up — the biggest moment, a heavier hit. */
export function feedbackLevelUp(): void {
  haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  play("levelup");
}

/** Every ordinary tap — buttons, tabs, chips, steppers. Wired automatically by `HardShadow`'s default. */
export function feedbackLight(): void {
  haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** A primary/committed action — Save, Redeem confirm, Join group, Delete, Sign out. */
export function feedbackMedium(): void {
  haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Something needs attention — a blocked action or a risk the user should notice. Same primitive `ConnectionToast` already uses for network errors. */
export function feedbackWarning(): void {
  haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
