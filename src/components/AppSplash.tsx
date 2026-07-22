import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, AccessibilityInfo, Easing } from "react-native";
import { theme } from "@/constants/theme";

/**
 * Custom splash matching the app icon (direction 1d — "Level-up H"): the
 * two bars rise into place ("ascending"), then the yellow cap pops in,
 * before handing off to the real app. Falls back to a static (no-animation)
 * render of the same icon when the OS reduce-motion setting is on.
 */
export function AppSplash({ onDone }: { onDone: () => void }) {
  const leftScale = useRef(new Animated.Value(0)).current;
  const rightScale = useRef(new Animated.Value(0)).current;
  const capScale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return; // still checking

    if (reduceMotion) {
      // Static icon, brief hold, no animation — per the design's own note.
      leftScale.setValue(1);
      rightScale.setValue(1);
      capScale.setValue(1);
      const t = setTimeout(() => {
        Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(onDone);
      }, 300);
      return () => clearTimeout(t);
    }

    Animated.sequence([
      Animated.stagger(90, [
        Animated.timing(leftScale, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rightScale, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.spring(capScale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 200, delay: 150, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDone());
  }, [reduceMotion]);

  if (reduceMotion === null) return <View style={styles.root} />;

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <View style={styles.h}>
        <Animated.View style={[styles.leg, styles.legLeft, { transform: [{ scaleY: leftScale }] }]} />
        <Animated.View style={[styles.leg, styles.legRight, { transform: [{ scaleY: rightScale }] }]} />
        <View style={styles.crossbar} />
        <Animated.View style={[styles.cap, { transform: [{ scale: capScale }] }]} />
      </View>
    </Animated.View>
  );
}

const LEG_WIDTH = 26;
const LEFT_HEIGHT = 96;
const RIGHT_HEIGHT = 140;
const GAP = 48;

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.color.violet,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  h: { width: LEG_WIDTH * 2 + GAP, height: RIGHT_HEIGHT, position: "relative" },
  leg: { position: "absolute", width: LEG_WIDTH, backgroundColor: theme.color.ink, bottom: 0 },
  legLeft: { left: 0, height: LEFT_HEIGHT },
  legRight: { left: LEG_WIDTH + GAP, height: RIGHT_HEIGHT },
  crossbar: {
    position: "absolute",
    left: LEG_WIDTH,
    width: GAP,
    height: LEG_WIDTH,
    backgroundColor: theme.color.ink,
    bottom: LEFT_HEIGHT / 2 - LEG_WIDTH / 2,
  },
  cap: {
    position: "absolute",
    left: LEG_WIDTH + GAP - 10,
    width: LEG_WIDTH + 20,
    height: 18,
    backgroundColor: theme.color.yellow,
    top: 0,
  },
});
