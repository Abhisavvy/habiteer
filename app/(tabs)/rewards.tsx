import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Plus } from "lucide-react-native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useCoinBalanceQuery } from "@/features/completions/useCompletions";
import {
  useRewardsQuery,
  useCreateReward,
  useUpdateReward,
  useDeleteReward,
  useRedeemReward,
} from "@/features/rewards/useRewards";
import { RewardCard } from "@/features/rewards/components/RewardCard";
import { RewardPanel } from "@/features/rewards/components/RewardPanel";
import type { Reward } from "@/features/rewards/api";

type PanelState = { mode: "add" } | { mode: "edit"; reward: Reward } | null;

export default function Rewards() {
  const { data: coinBalance } = useCoinBalanceQuery();
  const { data: rewards, isLoading, error } = useRewardsQuery();
  const createMutation = useCreateReward();
  const updateMutation = useUpdateReward();
  const deleteMutation = useDeleteReward();
  const redeemMutation = useRedeemReward();
  const [panel, setPanel] = useState<PanelState>(null);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>REWARDS</Text>
        <View style={styles.statBadge}>
          <Text style={styles.statText}>🪙 {coinBalance ?? 0}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load your rewards. Pull to retry.</Text>}

        <View style={styles.list}>
          {rewards?.map((r) => (
            <RewardCard
              key={r.id}
              reward={r}
              redeeming={redeemMutation.isPending}
              onEdit={() => setPanel({ mode: "edit", reward: r })}
              onDelete={() => deleteMutation.mutate(r.id)}
              onRedeem={() => {
                redeemMutation.mutate(r.id, {
                  onError: (e: Error) => Alert.alert("Couldn't redeem that", e.message),
                });
              }}
            />
          ))}
        </View>

        {panel?.mode === "add" && (
          <RewardPanel
            mode="add"
            submitting={createMutation.isPending}
            onCancel={() => setPanel(null)}
            onSubmit={(values) => {
              createMutation.mutate(values, {
                onSuccess: () => setPanel(null),
                onError: (e) => Alert.alert("Couldn't add that", e.message),
              });
            }}
          />
        )}
        {panel?.mode === "edit" && (
          <RewardPanel
            mode="edit"
            initial={panel.reward}
            submitting={updateMutation.isPending}
            onCancel={() => setPanel(null)}
            onSubmit={(values) => {
              updateMutation.mutate(
                { id: panel.reward.id, values },
                {
                  onSuccess: () => setPanel(null),
                  onError: (e) => Alert.alert("Couldn't save that", e.message),
                }
              );
            }}
          />
        )}

        {!panel && (
          <Pressable style={styles.addBtn} onPress={() => setPanel({ mode: "add" })}>
            <Plus size={18} strokeWidth={3} color={theme.color.ink} />
            <Text style={styles.addText}>Add a reward</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
  },
  title: { fontSize: 20, fontWeight: "800", color: theme.color.ink, letterSpacing: 0.5, fontFamily: fonts.display700 },
  statBadge: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.color.card,
  },
  statText: { fontWeight: "700", fontSize: 13, color: theme.color.ink, fontFamily: fonts.mono700 },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  list: { gap: 12 },
  error: { textAlign: "center", marginTop: 40, color: theme.color.ink, opacity: 0.7 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderStyle: "dashed",
    borderRadius: theme.radius,
    paddingVertical: 14,
    backgroundColor: theme.color.card,
  },
  addText: { fontWeight: "700", fontSize: 15, color: theme.color.ink },
});
