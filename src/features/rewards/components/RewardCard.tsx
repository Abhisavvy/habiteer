import { View, Text, Pressable, StyleSheet } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import type { Reward } from "../api";

export function RewardCard({
  reward,
  canAfford,
  onEdit,
  onDelete,
  onRedeem,
  onLockedPress,
  redeeming,
}: {
  reward: Reward;
  canAfford: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRedeem: () => void;
  onLockedPress: () => void;
  redeeming?: boolean;
}) {
  return (
    <HardShadow style={[styles.card, !canAfford && styles.cardLocked]}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{reward.emoji}</Text>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {reward.name}
          </Text>
          <Text style={[styles.cost, !canAfford && styles.costLocked]}>{reward.cost} 🪙</Text>
        </View>
        {canAfford ? (
          <HardShadow style={styles.redeemBtn} onPress={onRedeem} disabled={redeeming} aria-label={`Redeem ${reward.name}`}>
            <Text style={styles.redeemText}>Redeem</Text>
          </HardShadow>
        ) : (
          <Pressable style={styles.lockedBtn} onPress={onLockedPress} aria-label={`${reward.name} locked`}>
            <Text style={styles.lockedText}>Locked</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onEdit} aria-label={`Edit ${reward.name}`}>
          <Text style={styles.actionText}>✎ Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete} aria-label={`Delete ${reward.name}`}>
          <Text style={styles.actionText}>🗑 Delete</Text>
        </Pressable>
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 13,
    gap: 8,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  cardLocked: { opacity: 0.85 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 30 },
  body: { flex: 1, minWidth: 0 },
  name: { fontWeight: "700", fontSize: 17, color: theme.color.ink, fontFamily: fonts.display700 },
  cost: { fontSize: 13, fontWeight: "700", color: theme.color.violet, marginTop: 2, fontFamily: fonts.mono700 },
  costLocked: { color: "rgba(26,21,35,0.5)" },
  redeemBtn: {
    height: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 11,
    backgroundColor: theme.color.jade,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  redeemText: { fontWeight: "700", fontSize: 14, color: theme.color.ink, fontFamily: fonts.display700 },
  lockedBtn: {
    height: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(26,21,35,0.4)",
    borderRadius: 11,
    backgroundColor: theme.color.paper,
  },
  lockedText: { fontWeight: "700", fontSize: 13, color: "rgba(26,21,35,0.5)", fontFamily: fonts.display700 },
  actions: { flexDirection: "row", gap: 16, justifyContent: "flex-end", paddingRight: 4, marginTop: -2 },
  actionText: { fontSize: 12, fontWeight: "600", color: "rgba(26,21,35,0.5)", fontFamily: fonts.display600 },
});
