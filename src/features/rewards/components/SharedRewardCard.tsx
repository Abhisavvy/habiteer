import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import type { SharedReward } from "../api";

export function SharedRewardCard({
  reward,
  onContribute,
  contributing,
}: {
  reward: SharedReward;
  onContribute: (amount: number) => void;
  contributing?: boolean;
}) {
  const [amount, setAmount] = useState("");
  const unlocked = reward.completedAt !== null;
  const progress = Math.min(1, reward.totalContributed / reward.cost);
  const canContribute = !unlocked && Number(amount) > 0;

  return (
    <HardShadow style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.emojiBox}>
          <Text style={styles.emoji}>{reward.emoji}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {reward.name}
          </Text>
          <Text style={styles.cost}>
            🪙 {reward.totalContributed} / {reward.cost}
          </Text>
        </View>
        {unlocked && <Text style={styles.unlockedBadge}>Unlocked!</Text>}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }, progress >= 1 && styles.progressFillFull]} />
      </View>

      {!unlocked && (
        <View style={styles.contributeRow}>
          <TextInput
            style={styles.amountInput}
            placeholder="Coins"
            placeholderTextColor="rgba(26,21,35,0.4)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
          />
          <HardShadow
            style={[styles.contributeBtn, !canContribute && styles.contributeBtnDisabled]}
            disabled={!canContribute || contributing}
            onPress={() => {
              onContribute(Number(amount));
              setAmount("");
            }}
          >
            <Text style={styles.contributeText}>Chip in</Text>
          </HardShadow>
        </View>
      )}
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
    gap: 10,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  emojiBox: {
    width: 46,
    height: 46,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.yellow,
  },
  emoji: { fontSize: 22 },
  body: { flex: 1, minWidth: 0 },
  name: { fontWeight: "700", fontSize: 16, color: theme.color.ink, fontFamily: fonts.display700 },
  cost: { fontSize: 13, fontWeight: "700", color: theme.color.violet, marginTop: 2, fontFamily: fonts.mono700 },
  unlockedBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.color.ink,
    backgroundColor: theme.color.jade,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: fonts.mono700,
  },
  progressTrack: {
    height: 14,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 999,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: theme.color.jade, borderRightWidth: theme.border, borderRightColor: theme.color.ink },
  progressFillFull: { borderRightWidth: 0 },
  contributeRow: { flexDirection: "row", gap: 8 },
  amountInput: {
    flex: 1,
    fontWeight: "600",
    fontSize: 14,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    borderRadius: 10,
    padding: 9,
    backgroundColor: theme.color.paper,
    color: theme.color.ink,
    fontFamily: fonts.display600,
  },
  contributeBtn: {
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.violet,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  contributeBtnDisabled: { opacity: 0.4 },
  contributeText: { fontWeight: "700", fontSize: 13, color: "#fff", fontFamily: fonts.display700 },
});
