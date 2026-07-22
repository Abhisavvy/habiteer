import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Mirrors the OS reduce-motion setting. Returns null until the initial check resolves. */
export function useReduceMotion(): boolean | null {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  return reduceMotion;
}
