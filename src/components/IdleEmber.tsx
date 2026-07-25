import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { Ember } from "@/components/Ember";
import { getReduceMotionCached } from "@/hooks/useReduceMotion";

const PEEK_EVERY_MS = 3200;
const PEEK_DURATION_MS = 220;

/**
 * `Ember` for empty/idle states — gently bobs and, every few seconds, cracks
 * its sleepy eyes open for a brief "peek" (dormant mascot, not lifeless).
 * Static (no bob, no peek) under the OS reduce-motion setting.
 */
export function IdleEmber({ size = 72 }: { size?: number }) {
  const bob = useRef(new Animated.Value(0)).current;
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    if (getReduceMotionCached() !== false) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();

    const peekTimer = setInterval(() => {
      setPeeking(true);
      setTimeout(() => setPeeking(false), PEEK_DURATION_MS);
    }, PEEK_EVERY_MS);

    return () => {
      loop.stop();
      clearInterval(peekTimer);
    };
  }, [bob]);

  return (
    <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>
      <Ember size={size} expression={peeking ? "neutral" : "sleepy"} />
    </Animated.View>
  );
}
