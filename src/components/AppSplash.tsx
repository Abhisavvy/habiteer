import { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, AccessibilityInfo, Easing } from "react-native";
import { theme } from "@/constants/theme";

/**
 * Custom splash matching the app icon exactly (direction 1d — "Level-up H"):
 * same violet badge frame, paper-fill/ink-outline H, yellow cap — not a
 * simplified stand-in. The two legs rise into place ("ascending"), the crossbar
 * reaches across to join them, then the yellow cap pops in, before handing off
 * to the real app. Falls back to a static (no-animation) render of the same icon
 * when the OS reduce-motion setting is on.
 *
 * The native pre-JS splash is deliberately the violet GROUND ONLY (see
 * app.config.ts) so this can build the icon from nothing. It used to draw the
 * finished icon, which made the handoff look like the icon shrinking and
 * breaking apart before reassembling itself.
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
  // The mark arrives as an object, then assembles, then hands off. Each value
  // is separate so the beats can overlap — a single timeline value would force
  // them to be strictly sequential, which is what made the old version read as
  // a checklist of animations rather than one movement.
  const badgeScale = useRef(new Animated.Value(0.82)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const leftScale = useRef(new Animated.Value(0)).current;
  const rightScale = useRef(new Animated.Value(0)).current;
  const crossbarScale = useRef(new Animated.Value(0)).current;
  const capScale = useRef(new Animated.Value(0)).current;
  const capLift = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return; // still checking

    const settle = () => {
      badgeScale.setValue(1);
      badgeOpacity.setValue(1);
      leftScale.setValue(1);
      rightScale.setValue(1);
      crossbarScale.setValue(1);
      capScale.setValue(1);
      capLift.setValue(1);
    };

    if (reduceMotion) {
      // Static mark, brief hold, then a plain fade — per the design's own note.
      settle();
      const t = setTimeout(() => {
        Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }).start(onDone);
      }, 300);
      return () => clearTimeout(t);
    }

    // ~1250ms total, matching the spec's 1200ms brief.
    //
    // The beats OVERLAP deliberately. The badge is still settling when the legs
    // start, and the cap fires before the crossbar has finished — that overlap
    // is most of the difference between motion that feels designed and motion
    // that feels like a sequence of tweens. Timings are staggered via delay
    // inside parallel branches rather than a strict sequence, so nothing waits
    // on a spring whose settle time can't be predicted exactly.
    const animation = Animated.parallel([
      // 1. The mark arrives — scales up from 0.82 with a little overshoot while
      //    fading in. This is the beat that was missing entirely: the badge used
      //    to simply exist from frame one.
      Animated.timing(badgeOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(badgeScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),

      // 2. The legs rise, tightly staggered. Springs rather than timings so they
      //    overshoot a touch and settle, instead of gliding to a dead stop.
      Animated.sequence([
        Animated.delay(140),
        Animated.stagger(80, [
          Animated.spring(leftScale, { toValue: 1, friction: 6.5, tension: 110, useNativeDriver: true }),
          Animated.spring(rightScale, { toValue: 1, friction: 6.5, tension: 110, useNativeDriver: true }),
        ]),
      ]),

      // 3. The crossbar reaches across to join them.
      Animated.sequence([
        Animated.delay(360),
        Animated.timing(crossbarScale, { toValue: 1, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),

      // 4. The cap is the hero beat — it is the "level up" in the icon, so it
      //    gets the bounciest spring and drops into place from slightly above
      //    rather than merely scaling. Lands last, on its own, so the eye is on
      //    it when the mark completes.
      Animated.sequence([
        Animated.delay(470),
        Animated.parallel([
          Animated.spring(capScale, { toValue: 1, friction: 5, tension: 150, useNativeDriver: true }),
          Animated.spring(capLift, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }),
        ]),
      ]),

      // 5. Hand off: the mark pushes very slightly toward the viewer as the
      //    whole overlay fades. Scaling out on exit reads as the splash giving
      //    way to the app; a bare opacity fade reads as it being switched off.
      Animated.sequence([
        Animated.delay(880),
        Animated.parallel([
          Animated.timing(badgeScale, { toValue: 1.07, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(fade, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
    ]);

    animation.start(() => onDone());

    // The splash is an OVERLAY on the whole app, so `onDone` must fire no matter
    // what — it is the only thing that unmounts it. This previously read
    // `({ finished }) => finished && onDone()`, and an RN Animated composition
    // reports finished: false whenever it is interrupted. Launching the app and
    // immediately backgrounding it (or, as observed on device, launching while
    // the screen was asleep) interrupted it, so onDone never fired and the app
    // sat on the splash forever with no error and no way out but a force-quit.
    // An interrupted intro is not a reason to withhold the app.
    //
    // The timer is the belt to that braces: if the callback never runs at all
    // because the driver never picked the animation up, this still releases the
    // overlay. Generous enough never to clip the ~1250ms choreography.
    const failsafe = setTimeout(onDone, 2500);
    return () => {
      clearTimeout(failsafe);
      animation.stop();
    };
  }, [reduceMotion]);

  if (reduceMotion === null) return <View style={styles.root} />;

  // Drops in from 6px above its resting position.
  const capTranslateY = capLift.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <Animated.View
        style={[styles.badge, { opacity: badgeOpacity, transform: [{ scale: badgeScale }] }]}
      >
        <Animated.View style={[styles.leg, px(LEFT), { transform: [{ scaleY: leftScale }], transformOrigin: "bottom" }]} />
        <Animated.View style={[styles.leg, px(RIGHT), { transform: [{ scaleY: rightScale }], transformOrigin: "bottom" }]} />
        <Animated.View
          style={[styles.crossbar, px(CROSSBAR), { transform: [{ scaleX: crossbarScale }], transformOrigin: "left" }]}
        />
        <Animated.View
          style={[styles.cap, px(CAP), { transform: [{ scale: capScale }, { translateY: capTranslateY }] }]}
        />
      </Animated.View>
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
