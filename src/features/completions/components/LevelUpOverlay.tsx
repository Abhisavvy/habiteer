import { useEffect, useRef, useState } from "react";
import { Text, Pressable, StyleSheet, Animated } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
import { Confetti } from "@/components/Confetti";
import { Ember } from "@/components/Ember";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/** The biggest celebration (P2 §08 ★, 1400ms): scrim fades in → card
 * springs in → confetti bursts → the mascot pops. Each beat is staged, not
 * simultaneous. Reduce-motion collapses to a static card with no confetti,
 * per the spec's own fallback. */
export function LevelUpOverlay({
  level,
  freezeGained,
  onClose,
}: {
  level: number;
  freezeGained?: number;
  onClose: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const scrim = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const emberPop = useRef(new Animated.Value(0)).current;
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (reduceMotion === null) return; // still checking
    if (reduceMotion) {
      scrim.setValue(1);
      scale.setValue(1);
      cardFade.setValue(1);
      emberPop.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.timing(scrim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
        Animated.timing(cardFade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
    // Confetti + mascot pop land after the card has settled (~third beat).
    const t = setTimeout(() => {
      setShowConfetti(true);
      Animated.spring(emberPop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
    }, 520);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  if (reduceMotion === null) return null;

  const freezeLine =
    freezeGained && freezeGained > 0
      ? ` +${freezeGained} ❄️ freeze token${freezeGained > 1 ? "s" : ""} earned.`
      : "";

  const emberRotate = emberPop.interpolate({ inputRange: [0, 1], outputRange: ["-12deg", "0deg"] });

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Animated.View style={[styles.scrim, { opacity: scrim }]} pointerEvents="none" />
      <HardShadow style={styles.card} animatedStyle={{ opacity: cardFade, transform: [{ scale }] }}>
        <Halftone color="#FFFFFF" opacity={0.4} id="levelup-sun" />
        <Text style={styles.party}>🎉</Text>
        <Text style={styles.num}>LEVEL {level}!</Text>
        <Animated.View style={{ transform: [{ scale: emberPop }, { rotate: emberRotate }] }}>
          <Ember size={72} expression="celebrate" />
        </Animated.View>
        <Text style={styles.subtitle}>Ember's glowing brighter!{freezeLine}</Text>
        <HardShadow style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Keep going!</Text>
        </HardShadow>
      </HardShadow>
      {showConfetti && <Confetti />}
    </Pressable>
  );
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 50,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(36,27,51,0.55)",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 320,
    backgroundColor: theme.color.hero,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 2,
    overflow: "hidden",
    shadowColor: INK,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  party: { fontSize: 38 },
  num: { fontSize: 32, color: theme.color.gold, fontFamily: fonts.heading, letterSpacing: 1 },
  subtitle: {
    fontWeight: "600",
    fontSize: 12.5,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 4,
    fontFamily: fonts.display600,
  },
  button: {
    marginTop: 6,
    width: "100%",
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.gold,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 11,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  buttonText: { fontWeight: "700", fontSize: 14, color: INK, fontFamily: fonts.display700 },
});
