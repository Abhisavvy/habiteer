import { useEffect, useRef, useState } from "react";
import { Animated, Text, StyleSheet } from "react-native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";

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
  const translateY = useRef(new Animated.Value(6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -4, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.05, duration: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(translateY, { toValue: -40, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 700, delay: 50, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => finished && onDone());
  }, []);

  return (
    <Animated.Text
      style={[
        styles.text,
        { left: anchor.x - 30, top: anchor.y - 50, opacity, transform: [{ translateY }, { scale }] },
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
