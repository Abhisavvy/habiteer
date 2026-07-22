import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useCompletionsQuery } from "@/features/completions/useCompletions";
import { overallProgress } from "@/features/completions/derived";
import { useGroupDetailQuery } from "@/features/groups/useGroups";
import { useSharedRewardsQuery, useCreateSharedReward, useContributeToReward } from "@/features/rewards/useRewards";
import { SharedRewardCard } from "@/features/rewards/components/SharedRewardCard";
import { RewardPanel } from "@/features/rewards/components/RewardPanel";

// PLAN.md §9 — mirrors the "create groups at level 3" WITH CHECK in rls.sql,
// which also gates shared-reward creation. The server is authoritative.
const SHARED_REWARD_CREATE_LEVEL = 3;

export default function GroupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: completions } = useCompletionsQuery();
  const { level } = overallProgress(completions ?? []);
  const { data: group, isLoading, error } = useGroupDetailQuery(id);
  const { data: sharedRewards } = useSharedRewardsQuery(id);
  const createRewardMutation = useCreateSharedReward(id);
  const contributeMutation = useContributeToReward(id);
  const [panelOpen, setPanelOpen] = useState(false);

  const canCreateReward = level >= SHARED_REWARD_CREATE_LEVEL;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <HardShadow style={styles.backBtn} onPress={() => router.back()} aria-label="Back">
          <ArrowLeft size={18} strokeWidth={2.5} color={theme.color.ink} />
        </HardShadow>
        <Text style={styles.title} numberOfLines={1}>
          {group?.name ?? "Group"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load this group.</Text>}

        {group && (
          <>
            <HardShadow style={styles.codeCard}>
              <Text style={styles.codeLabel}>Invite code</Text>
              <Text style={styles.codeValue}>{group.inviteCode}</Text>
            </HardShadow>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Members · {group.members.length}</Text>
              <View style={styles.memberRow}>
                {group.members.map((m) => (
                  <View key={m.userId} style={styles.memberChip}>
                    <Text style={styles.memberText}>
                      {m.avatar} {m.displayName}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shared rewards</Text>
              <View style={styles.list}>
                {sharedRewards?.map((r) => (
                  <SharedRewardCard
                    key={r.id}
                    reward={r}
                    contributing={contributeMutation.isPending}
                    onContribute={(amount) => {
                      contributeMutation.mutate(
                        { rewardId: r.id, amount },
                        { onError: (e: Error) => Alert.alert("Couldn't chip in", e.message) }
                      );
                    }}
                  />
                ))}
              </View>

              {panelOpen ? (
                <RewardPanel
                  mode="add"
                  submitting={createRewardMutation.isPending}
                  onCancel={() => setPanelOpen(false)}
                  onSubmit={(values) => {
                    createRewardMutation.mutate(values, {
                      onSuccess: () => setPanelOpen(false),
                      onError: (e) => Alert.alert("Couldn't add that", e.message),
                    });
                  }}
                />
              ) : (
                <>
                  {!canCreateReward && (
                    <Text style={styles.hint}>
                      Reach level {SHARED_REWARD_CREATE_LEVEL} to add a shared reward — you're level {level}.
                    </Text>
                  )}
                  <HardShadow
                    style={[styles.addBtn, !canCreateReward && styles.addBtnDisabled]}
                    disabled={!canCreateReward}
                    onPress={() => setPanelOpen(true)}
                  >
                    <Text style={styles.addText}>＋ Add a shared reward</Text>
                  </HardShadow>
                </>
              )}
            </View>
          </>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: theme.color.ink, fontFamily: fonts.display700 },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 18 },
  error: { textAlign: "center", marginTop: 40, color: theme.color.ink, opacity: 0.7 },
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.color.violet,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  codeLabel: { fontWeight: "700", fontSize: 13, color: "#fff", opacity: 0.85, fontFamily: fonts.display600 },
  codeValue: { fontWeight: "800", fontSize: 20, color: "#fff", letterSpacing: 2, fontFamily: fonts.mono700 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(26,21,35,0.5)",
    fontFamily: fonts.mono700,
  },
  memberRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberChip: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.color.card,
  },
  memberText: { fontWeight: "600", fontSize: 13, color: theme.color.ink, fontFamily: fonts.display600 },
  list: { gap: 12 },
  hint: { fontSize: 12, fontWeight: "700", color: theme.color.fire, marginBottom: 8, fontFamily: fonts.mono700 },
  addBtn: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.violet,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  addBtnDisabled: { opacity: 0.4 },
  addText: { fontWeight: "700", fontSize: 15, color: "#fff", fontFamily: fonts.display700 },
});
