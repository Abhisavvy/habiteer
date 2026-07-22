import { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing } from "react-native";
import { HardShadow } from "@/components/HardShadow";
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
  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const cardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion === null) return; // still checking

    if (reduceMotion) {
      scale.setValue(1);
      cardFade.setValue(1);
      return; // no confetti spin either
    }

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
      Animated.timing(cardFade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, [reduceMotion]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  if (reduceMotion === null) return null;

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <HardShadow style={styles.card} animatedStyle={{ opacity: cardFade, transform: [{ scale }] }}>
        <View style={[styles.confetti, styles.confettiFire]} />
        <View style={[styles.confetti, styles.confettiJade]} />
        <View style={[styles.confetti, styles.confettiViolet]} />

        <View style={styles.starWrap}>
          <Animated.Text style={[styles.burst, { transform: [{ rotate }] }]}>✦</Animated.Text>
          <Text style={styles.star}>★</Text>
        </View>

        <Text style={styles.title}>LEVEL UP</Text>
        <Text style={styles.num}>LVL {level}</Text>

        {!!freezeGained && freezeGained > 0 && (
          <HardShadow style={styles.freezeBadge}>
            <Text style={styles.freezeText}>
              ❄️ +{freezeGained} freeze token{freezeGained > 1 ? "s" : ""}
            </Text>
          </HardShadow>
        )}

        <Text style={styles.subtitle}>You're on fire 🔥</Text>

        <HardShadow style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Keep going</Text>
        </HardShadow>
      </HardShadow>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(26,21,35,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 50,
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 320,
    backgroundColor: theme.color.paper,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 18,
    paddingVertical: 30,
    paddingHorizontal: 22,
    alignItems: "center",
    gap: 6,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 8, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  confetti: { position: "absolute", width: 10, height: 10, borderWidth: 2, borderColor: theme.color.ink },
  confettiFire: { top: 16, left: 22, backgroundColor: theme.color.fire, borderRadius: 2, transform: [{ rotate: "20deg" }] },
  confettiJade: { top: 24, right: 30, backgroundColor: theme.color.jade, borderRadius: 10 },
  confettiViolet: { bottom: 40, left: 34, backgroundColor: theme.color.violet, borderRadius: 2, transform: [{ rotate: "45deg" }] },
  starWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  burst: { position: "absolute", fontSize: 90, color: theme.color.yellow },
  star: { fontSize: 46, color: theme.color.yellow },
  title: { fontWeight: "800", fontSize: 26, letterSpacing: 1, color: theme.color.ink, fontFamily: fonts.display700 },
  num: { fontWeight: "700", fontSize: 52, lineHeight: 52, color: theme.color.violet, fontFamily: fonts.mono700 },
  freezeBadge: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  freezeText: { fontWeight: "700", fontSize: 14, color: theme.color.ink, fontFamily: fonts.display700 },
  subtitle: { fontWeight: "600", fontSize: 14, color: "rgba(26,21,35,0.6)", marginTop: 4, fontFamily: fonts.display600 },
  button: {
    marginTop: 12,
    width: "100%",
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.violet,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  buttonText: { fontWeight: "700", fontSize: 16, color: "#fff", fontFamily: fonts.display700 },
});
