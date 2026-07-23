import { View, Text, Pressable, StyleSheet } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import type { Reward } from "../api";

// Exact tokens from the P2 "03 Rewards" mock.
const TILE_BG = "#EDE7FF"; // light-violet emoji tile (available)
const LOCKED_CARD_BG = "#F2EAD8";
const LOCKED_TILE_BG = "#E4DAC2";
const LOCKED_BTN_BG = "#DDD3BE";
const MUTED_INK = "rgba(36,27,51,0.6)";

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
        <View style={[styles.emojiBox, !canAfford && styles.emojiBoxLocked]}>
          <Text style={styles.emoji}>{reward.emoji}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {reward.name}
          </Text>
          <Text style={[styles.cost, !canAfford && styles.costLocked]}>🪙 {reward.cost}</Text>
        </View>
        {canAfford ? (
          <HardShadow style={styles.redeemBtn} onPress={onRedeem} disabled={redeeming} aria-label={`Redeem ${reward.name}`}>
            <Text style={styles.redeemText}>Redeem</Text>
          </HardShadow>
        ) : (
          <Pressable style={styles.lockedBtn} onPress={onLockedPress} aria-label={`${reward.name} locked`}>
            <Text style={styles.lockedText}>🔒 Locked</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onEdit} aria-label={`Edit ${reward.name}`} hitSlop={8}>
          <Text style={styles.actionText}>✎ Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete} aria-label={`Delete ${reward.name}`} hitSlop={8}>
          <Text style={styles.actionText}>🗑 Delete</Text>
        </Pressable>
      </View>
    </HardShadow>
  );
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardLocked: { backgroundColor: LOCKED_CARD_BG, opacity: 0.85 },
  row: { flexDirection: "row", alignItems: "center", gap: 11 },
  emojiBox: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TILE_BG,
  },
  emojiBoxLocked: { backgroundColor: LOCKED_TILE_BG },
  emoji: { fontSize: 24 },
  body: { flex: 1, minWidth: 0 },
  name: { fontWeight: "700", fontSize: 15, color: INK, fontFamily: fonts.display700 },
  cost: { fontSize: 12, fontWeight: "700", color: theme.color.ember, marginTop: 3, fontFamily: fonts.mono700 },
  costLocked: { color: MUTED_INK },
  redeemBtn: {
    height: 38,
    paddingHorizontal: 15,
    justifyContent: "center",
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 10,
    backgroundColor: theme.color.success,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  redeemText: { fontWeight: "700", fontSize: 13, color: theme.on.success, fontFamily: fonts.display700 },
  lockedBtn: {
    height: 38,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 10,
    backgroundColor: LOCKED_BTN_BG,
  },
  lockedText: { fontWeight: "700", fontSize: 12, color: MUTED_INK, fontFamily: fonts.display700 },
  actions: { flexDirection: "row", gap: 16, justifyContent: "flex-end", paddingRight: 4, marginTop: -2 },
  actionText: { fontSize: 12, fontWeight: "600", color: "rgba(36,27,51,0.5)", fontFamily: fonts.display600 },
});
