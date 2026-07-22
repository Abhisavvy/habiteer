import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetSnapshot } from "./snapshot";

const KEY = "habiteer:widget-snapshot";

export async function saveSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
}

/** Null if the widget has never been synced yet (e.g. fresh install, before first app open). */
export async function loadSnapshot(): Promise<WidgetSnapshot | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}
