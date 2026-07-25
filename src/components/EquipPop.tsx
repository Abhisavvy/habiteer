import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Animated } from "react-native";
import { getReduceMotionCached } from "@/hooks/useReduceMotion";

/**
 * Pops its child with a brief scale bounce the moment `equipped` transitions
 * false→true — not on mount (so an already-equipped item on screen load
 * doesn't pop), and not while it stays equipped across re-renders.
 */
export function EquipPop({ equipped, children }: { equipped: boolean; children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasEquipped = useRef(equipped);

  useEffect(() => {
    const justEquipped = equipped && !wasEquipped.current;
    wasEquipped.current = equipped;
    if (!justEquipped || getReduceMotionCached() !== false) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, speed: 40, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
  }, [equipped, scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}
