import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";

/** "Redeemed!" burst — visual only, no real sound/haptic playback yet
 * (matches the existing sounds/haptics "spec now, build later" precedent). */
export function RedeemSuccessOverlay({
  name,
  cost,
  onClose,
}: {
  name: string;
  cost: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <HardShadow style={styles.card}>
        <Halftone color="#FFFFFF" opacity={0.4} id="redeem-sun" />
        <Text style={styles.burst}>✨🪙✨</Text>
        <Text style={styles.title}>REDEEMED!</Text>
        <Text style={styles.detail}>
          {name} · −{cost} 🪙
        </Text>
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
  burst: { fontSize: 30 },
  title: { fontSize: 22, color: "#fff", marginTop: 4, fontFamily: fonts.heading, letterSpacing: 0.5 },
  detail: { fontWeight: "600", fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2, fontFamily: fonts.display600 },
});
