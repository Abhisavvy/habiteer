import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useAddAction } from "@/features/navigation/addAction";
import { HardShadow } from "@/components/HardShadow";
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
import { RedeemSuccessOverlay } from "@/features/rewards/components/RedeemSuccessOverlay";
import { RedeemConfirmModal } from "@/features/rewards/components/RedeemConfirmModal";
import { InsufficientFundsModal } from "@/features/rewards/components/InsufficientFundsModal";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
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
  const [redeemed, setRedeemed] = useState<Reward | null>(null);
  const [redeemConfirm, setRedeemConfirm] = useState<Reward | null>(null);
  const [lockedReward, setLockedReward] = useState<Reward | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Reward | null>(null);
  const balance = coinBalance ?? 0;

  const setAddHandler = useAddAction((s) => s.setHandler);
  useFocusEffect(
    useCallback(() => {
      setAddHandler(() => setPanel({ mode: "add" }));
      return () => setAddHandler(null);
    }, [setAddHandler])
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Rewards</Text>
        <HardShadow style={styles.statBadge}>
          <Text style={styles.statText}>🪙 {balance}</Text>
        </HardShadow>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load your rewards. Pull to retry.</Text>}

        <View style={styles.list}>
          {rewards?.map((r) => (
            <RewardCard
              key={r.id}
              reward={r}
              canAfford={balance >= r.cost}
              redeeming={redeemMutation.isPending}
              onEdit={() => setPanel({ mode: "edit", reward: r })}
              onDelete={() => setDeleteConfirm(r)}
              onRedeem={() => setRedeemConfirm(r)}
              onLockedPress={() => setLockedReward(r)}
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

      </ScrollView>

      {redeemed && (
        <RedeemSuccessOverlay name={redeemed.name} cost={redeemed.cost} onClose={() => setRedeemed(null)} />
      )}

      {redeemConfirm && (
        <RedeemConfirmModal
          visible
          name={redeemConfirm.name}
          emoji={redeemConfirm.emoji}
          cost={redeemConfirm.cost}
          balance={balance}
          onCancel={() => setRedeemConfirm(null)}
          onConfirm={() => {
            const r = redeemConfirm;
            setRedeemConfirm(null);
            redeemMutation.mutate(r.id, {
              onSuccess: () => setRedeemed(r),
              onError: (e: Error) => Alert.alert("Couldn't redeem that", e.message),
            });
          }}
        />
      )}

      {lockedReward && (
        <InsufficientFundsModal
          visible
          name={lockedReward.name}
          cost={lockedReward.cost}
          balance={balance}
          onClose={() => setLockedReward(null)}
        />
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          visible
          name={deleteConfirm.name}
          streakDays={0}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => {
            const r = deleteConfirm;
            setDeleteConfirm(null);
            deleteMutation.mutate(r.id, {
              onError: (e: Error) => Alert.alert("Couldn't delete that", e.message),
            });
          }}
        />
      )}
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
  title: { fontSize: 22, fontWeight: "800", color: theme.color.ink, fontFamily: fonts.display700 },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: theme.color.yellow,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  statText: { fontWeight: "700", fontSize: 19, color: theme.color.ink, fontFamily: fonts.mono700 },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  list: { gap: 12 },
  error: { textAlign: "center", marginTop: 40, color: theme.color.ink, opacity: 0.7 },
});
