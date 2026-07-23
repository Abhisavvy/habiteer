import { useEffect, useRef } from "react";
import { Text, Pressable, StyleSheet, Animated } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
import { Ember } from "@/components/Ember";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useReduceMotion } from "@/hooks/useReduceMotion";

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
  const scale = useRef(new Animated.Value(0.85)).current;
  const cardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion === null) return; // still checking
    if (reduceMotion) {
      scale.setValue(1);
      cardFade.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
      Animated.timing(cardFade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion]);

  if (reduceMotion === null) return null;

  const freezeLine =
    freezeGained && freezeGained > 0
      ? ` +${freezeGained} ❄️ freeze token${freezeGained > 1 ? "s" : ""} earned.`
      : "";

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <HardShadow style={styles.card} animatedStyle={{ opacity: cardFade, transform: [{ scale }] }}>
        <Halftone color="#FFFFFF" opacity={0.4} id="levelup-sun" />
        <Text style={styles.party}>🎉</Text>
        <Text style={styles.num}>LEVEL {level}!</Text>
        <Ember size={72} expression="celebrate" />
        <Text style={styles.subtitle}>Ember's glowing brighter!{freezeLine}</Text>
        <HardShadow style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Keep going!</Text>
        </HardShadow>
      </HardShadow>
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
    backgroundColor: "rgba(36,27,51,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 50,
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
