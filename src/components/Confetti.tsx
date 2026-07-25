import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { theme } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/**
 * A one-shot confetti burst — a handful of comic-colored chips that fly
 * outward from the center, tumble, and fade. Pure RN `Animated` (no new
 * dependency, matching the P2 §08 "timing/spring only" note) and
 * self-gating on reduce-motion (renders nothing when the OS setting is on,
 * per the spec's "no confetti" fallback). Kept generic so the level-up
 * overlay uses it now and later marquee moments (quest claim, streak
 * milestone) can reuse it. Absolutely fills its parent and never
 * intercepts touches.
 */
const CHIP_COLORS = [
  theme.color.gold,
  theme.color.ember,
  theme.color.success,
  theme.color.hero,
  theme.color.danger,
  theme.color.info,
];

export function Confetti({ count = 14, duration = 900 }: { count?: number; duration?: number }) {
  const reduceMotion = useReduceMotion();

  if (reduceMotion === null || reduceMotion) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <Chip key={i} index={i} count={count} duration={duration} />
      ))}
    </View>
  );
}

function Chip({ index, count, duration }: { index: number; count: number; duration: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  // Deterministic per-index spread (no Math.random, so a chip's path is
  // stable across re-renders): fan evenly around the circle with a small
  // index-derived wobble, and vary distance/size in a fixed cycle.
  const angle = (index / count) * 2 * Math.PI + (index % 2 === 0 ? 0.25 : -0.25);
  const distance = 120 + (index % 3) * 34;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;
  const size = 7 + (index % 3) * 2;
  const color = CHIP_COLORS[index % CHIP_COLORS.length];
  const spin = index % 2 === 0 ? 1 : -1;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration,
      delay: (index % 5) * 30,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  // A little downward gravity added to the outward fly so it arcs, not just radiates.
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, dy + 46] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${spin * 400}deg`] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: 1.5,
        backgroundColor: color,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
