import { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing } from "react-native";
import { theme } from "@/constants/theme";

export function LevelUpOverlay({ level, onClose }: { level: number; onClose: () => void }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true })
    );
    anim.start();
    const t = setTimeout(onClose, 1800);
    return () => {
      anim.stop();
      clearTimeout(t);
    };
  }, [onClose]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <View style={styles.card}>
        <Animated.Text style={[styles.burst, { transform: [{ rotate }] }]}>★</Animated.Text>
        <Text style={styles.title}>LEVEL UP</Text>
        <Text style={styles.num}>LVL {level}</Text>
      </View>
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
    backgroundColor: "rgba(26,21,35,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  card: {
    backgroundColor: theme.color.yellow,
    borderWidth: 4,
    borderColor: theme.color.ink,
    borderRadius: 18,
    paddingVertical: 32,
    paddingHorizontal: 44,
    alignItems: "center",
    gap: 4,
  },
  burst: { fontSize: 40 },
  title: { fontWeight: "800", fontSize: 26, letterSpacing: 1, color: theme.color.ink },
  num: {
    fontWeight: "700",
    fontSize: 16,
    backgroundColor: theme.color.ink,
    color: theme.color.yellow,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
});
