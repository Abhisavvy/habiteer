import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
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
    <View style={styles.card}>
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
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {!unlocked && (
        <View style={styles.contributeRow}>
          <TextInput
            style={styles.amountInput}
            placeholder="Coins"
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
          />
          <Pressable
            style={[styles.contributeBtn, !canContribute && styles.contributeBtnDisabled]}
            disabled={!canContribute || contributing}
            onPress={() => {
              onContribute(Number(amount));
              setAmount("");
            }}
          >
            <Text style={styles.contributeText}>Chip in</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 12,
    gap: 10,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
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
  name: { fontWeight: "700", fontSize: 16, color: theme.color.ink, fontFamily: fonts.display600 },
  cost: { fontSize: 12, fontWeight: "700", color: theme.color.ink, marginTop: 2, fontFamily: fonts.mono700 },
  unlockedBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    backgroundColor: theme.color.jade,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  progressTrack: {
    height: 12,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 6,
    backgroundColor: theme.color.paper,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: theme.color.jade },
  contributeRow: { flexDirection: "row", gap: 8 },
  amountInput: {
    flex: 1,
    fontWeight: "700",
    fontSize: 14,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    padding: 8,
    backgroundColor: "#fff",
    color: theme.color.ink,
  },
  contributeBtn: {
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.violet,
  },
  contributeBtnDisabled: { opacity: 0.4 },
  contributeText: { fontWeight: "700", fontSize: 13, color: "#fff" },
});
