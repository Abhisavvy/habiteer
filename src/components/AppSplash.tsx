import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, AccessibilityInfo, Easing } from "react-native";
import { theme } from "@/constants/theme";

/**
 * Custom splash matching the app icon exactly (direction 1d — "Level-up H"):
 * same violet badge frame, paper-fill/ink-outline H, yellow cap — not a
 * simplified stand-in. The two legs rise into place ("ascending"), then the
 * yellow cap pops in, before handing off to the real app. Falls back to a
 * static (no-animation) render of the same icon when the OS reduce-motion
 * setting is on.
 *
 * Geometry is lifted directly from the icon's own SVG spec (gen-icon.js):
 * a 100x100 viewBox, badge inset 4 units with a 5-unit stroke, H decomposed
 * into 3 rects (legs + crossbar), cap as a 4th rect overlapping the right
 * leg's top. Coordinates below are shifted by -4 so (0,0) is the badge's
 * own inner corner, then scaled by BOX_UNIT to pixels. Each bar's own
 * border does the "ink outline + paper fill" look in one view — RN's
 * border-box model already insets the fill by the border width, matching
 * the icon's stroked-rect look closely enough for a brief intro animation.
 */
const BADGE_SIZE = 168; // px, the badge's own outer edge (border-box)
const BOX_UNIT = BADGE_SIZE / 100; // viewBox units -> px
const STROKE = 5 * BOX_UNIT;
const CAP_STROKE = 3 * BOX_UNIT;
const BADGE_RADIUS = 22 * BOX_UNIT;
const BADGE_BOX = 92 * BOX_UNIT; // the icon's own 92x92 box (viewBox already inset by its own 4-unit margin)

// Rects in the shifted (badge-local, margin already excluded) coordinate
// space, in viewBox units — matches gen-icon.js's LEFT/RIGHT/CROSSBAR/CAP.
const LEFT = { x0: 26, x1: 39, y0: 36, y1: 70 };
const RIGHT = { x0: 53, x1: 66, y0: 20, y1: 70 };
const CROSSBAR = { x0: 39, x1: 53, y0: 44, y1: 52 };
const CAP = { x0: 53, x1: 66, y0: 20, y1: 31 };

function px(r: { x0: number; x1: number; y0: number; y1: number }) {
  return {
    left: r.x0 * BOX_UNIT,
    top: r.y0 * BOX_UNIT,
    width: (r.x1 - r.x0) * BOX_UNIT,
    height: (r.y1 - r.y0) * BOX_UNIT,
  };
}

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
      <View style={styles.badge}>
        <Animated.View style={[styles.leg, px(LEFT), { transform: [{ scaleY: leftScale }], transformOrigin: "bottom" }]} />
        <Animated.View style={[styles.leg, px(RIGHT), { transform: [{ scaleY: rightScale }], transformOrigin: "bottom" }]} />
        <View style={[styles.crossbar, px(CROSSBAR)]} />
        <Animated.View style={[styles.cap, px(CAP), { transform: [{ scale: capScale }] }]} />
      </View>
    </Animated.View>
  );
}

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
  badge: {
    width: BADGE_BOX,
    height: BADGE_BOX,
    borderRadius: BADGE_RADIUS,
    borderWidth: STROKE,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.violet,
  },
  leg: {
    position: "absolute",
    backgroundColor: theme.color.paper,
    borderWidth: STROKE,
    borderColor: theme.color.ink,
    borderRadius: 3 * BOX_UNIT,
  },
  crossbar: {
    position: "absolute",
    backgroundColor: theme.color.paper,
    borderWidth: STROKE,
    borderColor: theme.color.ink,
    borderRadius: 3 * BOX_UNIT,
  },
  cap: {
    position: "absolute",
    backgroundColor: theme.color.yellow,
    borderWidth: CAP_STROKE,
    borderColor: theme.color.ink,
  },
});
