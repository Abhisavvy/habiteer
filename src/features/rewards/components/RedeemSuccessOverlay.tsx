import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
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
      <View style={styles.card}>
        <Text style={styles.burst}>🎉</Text>
        <Text style={styles.title}>Redeemed!</Text>
        <Text style={styles.detail}>
          {name} · −{cost} 🪙
        </Text>
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
    backgroundColor: theme.color.jade,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    minWidth: 220,
  },
  burst: { fontSize: 34 },
  title: { fontWeight: "800", fontSize: 20, color: theme.color.ink, marginTop: 4, fontFamily: fonts.display700 },
  detail: { fontWeight: "700", fontSize: 13, color: theme.color.ink, marginTop: 2, fontFamily: fonts.mono700 },
});
