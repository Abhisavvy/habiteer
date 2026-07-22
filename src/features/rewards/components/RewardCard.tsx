import { View, Text, Pressable, StyleSheet } from "react-native";
import { Pencil, X } from "lucide-react-native";
import { theme } from "@/constants/theme";
import type { Reward } from "../api";

export function RewardCard({
  reward,
  onEdit,
  onDelete,
  onRedeem,
  redeeming,
}: {
  reward: Reward;
  onEdit: () => void;
  onDelete: () => void;
  onRedeem: () => void;
  redeeming?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.emojiBox}>
        <Text style={styles.emoji}>{reward.emoji}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {reward.name}
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.iconBtn} onPress={onEdit} aria-label={`Edit ${reward.name}`}>
              <Pencil size={14} strokeWidth={3} color={theme.color.ink} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={onDelete} aria-label={`Delete ${reward.name}`}>
              <X size={14} strokeWidth={3} color={theme.color.ink} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.cost}>🪙 {reward.cost}</Text>
      </View>
      <Pressable style={styles.redeemBtn} onPress={onRedeem} disabled={redeeming} aria-label={`Redeem ${reward.name}`}>
        <Text style={styles.redeemText}>Redeem</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 12,
  },
  emojiBox: {
    width: 46,
    height: 46,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.yellow,
  },
  emoji: { fontSize: 22 },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontWeight: "700", fontSize: 16, color: theme.color.ink, flexShrink: 1 },
  actions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  cost: { fontSize: 12, fontWeight: "700", color: theme.color.ink, marginTop: 4 },
  redeemBtn: {
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.color.jade,
  },
  redeemText: { fontWeight: "700", fontSize: 13, color: "#fff" },
});
