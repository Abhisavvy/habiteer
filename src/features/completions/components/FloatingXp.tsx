import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet } from "react-native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";

// Approximate fixed point over the header's XP bar — a real measured
// LevelBar position would need a layout-measurement pipeline (a ref passed
// down through the overlay); this fixed point is the pragmatic version for
// what's meant to be a small motion touch, not a new plumbing layer.
const ARC_TARGET_Y = 95;

type Anchor = { x: number; y: number };
type Float = { id: string; amount: number; anchor: Anchor };

/** Manages a list of transient "+N XP" floats, card-anchored to wherever the
 * habit/task was actually tapped rather than a fixed header position. */
export function useFloatingXp() {
  const [floats, setFloats] = useState<Float[]>([]);
  const spawn = (amount: number, anchor: Anchor) => {
    if (amount <= 0) return;
    const id = Math.random().toString(36).slice(2);
    setFloats((f) => [...f, { id, amount, anchor }]);
  };
  const remove = (id: string) => setFloats((f) => f.filter((x) => x.id !== id));
  return { floats, spawn, remove };
}

export function FloatingXpOverlay({ floats, onDone }: { floats: Float[]; onDone: (id: string) => void }) {
  return (
    <>
      {floats.map((f) => (
        <FloatingXpItem key={f.id} amount={f.amount} anchor={f.anchor} onDone={() => onDone(f.id)} />
      ))}
    </>
  );
}

function FloatingXpItem({ amount, anchor, onDone }: { amount: number; anchor: Anchor; onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  // Arcs toward the header's XP bar instead of floating straight up in
  // place: X and Y are both driven off the SAME linear `progress`, but
  // interpolated with different curve shapes — Y rises fast early, X stays
  // mostly put at first then sweeps sideways late — the mismatch between
  // the two is what reads as a curved path rather than a straight line.
  const targetX = Dimensions.get("window").width / 2;
  const dx = targetX - anchor.x;
  const dy = ARC_TARGET_Y - anchor.y;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.05, duration: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration: 650, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.6, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 250, delay: 400, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => finished && onDone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, dy * 0.85, dy] });
  const translateX = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dx * 0.15, dx] });

  return (
    <Animated.Text
      style={[
        styles.text,
        { left: anchor.x - 30, top: anchor.y - 50, opacity, transform: [{ translateX }, { translateY }, { scale }] },
      ]}
      pointerEvents="none"
    >
      +{amount} XP
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: "absolute",
    fontWeight: "800",
    fontSize: 15,
    color: theme.color.ink,
    fontFamily: fonts.mono700,
    backgroundColor: theme.color.jade,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
