import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Animated } from "react-native";
import { getReduceMotionCached } from "@/hooks/useReduceMotion";

const STEP_MS = 60;
const MAX_STEPS = 8; // caps the stagger so a long list doesn't take forever to finish appearing

/**
 * Fades + rises one list item in on ITS OWN mount, delayed by `index` — used
 * for a card-list stagger. Give each item a stable `key` (e.g. the
 * trackable's id) so React keeps the same instance across re-renders; the
 * entrance then only plays once, on that item's first mount (initial load,
 * or a newly-added item), and never replays just because sibling data
 * changed (e.g. toggling a habit's done state re-renders the list without
 * remounting any `StaggerItem`).
 */
export function StaggerItem({ index, children }: { index: number; children: ReactNode }) {
  const reduceMotion = getReduceMotionCached();
  const anim = useRef(new Animated.Value(reduceMotion !== false ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion !== false) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index, MAX_STEPS) * STEP_MS,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={{ opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}
    >
      {children}
    </Animated.View>
  );
}
