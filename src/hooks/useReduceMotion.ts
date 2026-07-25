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

// Module-scope cache, checked once at import time rather than per-mount —
// for a component instantiated 100+ times per screen (HardShadow), a
// per-instance async AccessibilityInfo query would fire that many redundant
// native bridge calls on every mount. Same null-until-resolved contract as
// the hook above.
let cachedReduceMotion: boolean | null = null;
AccessibilityInfo.isReduceMotionEnabled().then((v) => {
  cachedReduceMotion = v;
});

/** Synchronous cached read of the OS reduce-motion setting, for hot/high-frequency call sites where `useReduceMotion()`'s per-instance query would be wasteful. Null until the first check resolves (shortly after app start). */
export function getReduceMotionCached(): boolean | null {
  return cachedReduceMotion;
}
