import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * UI-only preference toggle (sound effects, haptics) persisted locally.
 * No sound/haptic playback is actually wired yet — same "spec now, build
 * later" precedent as the Reminders stub.
 */
export function useBoolSetting(key: string, defaultValue: boolean): [boolean, () => void] {
  const storageKey = `settings.${key}`;
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((v) => {
      if (v !== null) setValue(v === "1");
    });
  }, [storageKey]);

  const toggle = () => {
    setValue((prev) => {
      const next = !prev;
      AsyncStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  };

  return [value, toggle];
}
