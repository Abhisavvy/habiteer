import { useEffect, useRef, useState } from "react";
import { Animated, Text, Pressable, StyleSheet, View } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/** Redeem burst (P2 §08 ★, ~1000ms): the card springs in, the halftone
 * "rays" scale/rotate up behind it, a handful of coins fly outward, then
 * "REDEEMED!" settles. Sound + haptic already fire from rewards.tsx's
 * redeem-success handler (feedbackRedeem); this is the visual layer.
 * Reduce-motion collapses to a static card that just holds and dismisses. */
export function RedeemSuccessOverlay({
  name,
  cost,
  onClose,
}: {
  name: string;
  cost: number;
  onClose: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(0.85)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const rays = useRef(new Animated.Value(0)).current;
  const [showCoins, setShowCoins] = useState(false);

  useEffect(() => {
    if (reduceMotion === null) return;
    // Auto-dismiss holds ~1.5s in both modes (the burst finishes ~1s, then
    // it lingers briefly before closing) — unchanged from the original.
    const dismiss = setTimeout(onClose, 1500);

    if (reduceMotion) {
      scale.setValue(1);
      fade.setValue(1);
      rays.setValue(1);
      return () => clearTimeout(dismiss);
    }

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 130, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(rays, { toValue: 1, duration: 500, delay: 120, useNativeDriver: true }),
    ]).start();
    const coinTimer = setTimeout(() => setShowCoins(true), 260);
    return () => {
      clearTimeout(dismiss);
      clearTimeout(coinTimer);
    };
  }, [reduceMotion]);

  if (reduceMotion === null) return null;

  const rayScale = rays.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const rayRotate = rays.interpolate({ inputRange: [0, 1], outputRange: ["-25deg", "0deg"] });

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <HardShadow style={styles.card} animatedStyle={{ opacity: fade, transform: [{ scale }] }}>
        <Animated.View
          style={[styles.rays, { opacity: rays, transform: [{ scale: rayScale }, { rotate: rayRotate }] }]}
          pointerEvents="none"
        >
          <Halftone color="#FFFFFF" opacity={0.4} id="redeem-sun" />
        </Animated.View>
        <Text style={styles.burst}>✨🪙✨</Text>
        <Text style={styles.title}>REDEEMED!</Text>
        <Text style={styles.detail}>
          {name} · −{cost} 🪙
        </Text>
      </HardShadow>
      {showCoins && <CoinBurst />}
    </Pressable>
  );
}

/** A few coins arcing outward from the card center — rendered as siblings of
 * the card (not inside it, which clips via overflow:hidden) so they fly free. */
function CoinBurst({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.coinLayer} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <Coin key={i} index={i} count={count} />
      ))}
    </View>
  );
}

function Coin({ index, count }: { index: number; count: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  // Fan the coins across the upper arc (so they spray up-and-out, not down).
  const angle = Math.PI + (index / (count - 1)) * Math.PI;
  const distance = 110 + (index % 2) * 30;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance;

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 800, delay: index * 25, useNativeDriver: true }).start();
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, dy + 60] });
  const opacity = progress.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.Text style={{ position: "absolute", fontSize: 20, opacity, transform: [{ translateX }, { translateY }] }}>
      🪙
    </Animated.Text>
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
    backgroundColor: "rgba(36,27,51,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  card: {
    backgroundColor: theme.color.success,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    minWidth: 220,
    overflow: "hidden",
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  rays: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  coinLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  burst: { fontSize: 30 },
  title: { fontSize: 22, color: "#fff", marginTop: 4, fontFamily: fonts.heading, letterSpacing: 0.5 },
  detail: { fontWeight: "600", fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2, fontFamily: fonts.display600 },
});
