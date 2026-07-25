import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Preference toggle (sound effects, haptics, reminders) persisted locally.
 * Sound/haptics ARE wired to real playback via `src/features/feedback/
 * feedback.ts` (feedbackComplete/feedbackRedeem/feedbackLevelUp), and
 * reminders are a fully real scheduling system (`src/features/reminders/`)
 * — this toggle is the master on/off switch each reads, not a placeholder.
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
