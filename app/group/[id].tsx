import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, Share } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useCompletionsQuery } from "@/features/completions/useCompletions";
import { overallProgress } from "@/features/completions/derived";
import { useGroupDetailQuery, useGroupActivityQuery } from "@/features/groups/useGroups";
import { groupStreak, membersDoneToday } from "@/features/groups/streak";
import { today } from "@/features/trackables/today";
import { useAuth } from "@/features/auth/useAuth";
import { avatarColorFor } from "@/features/cosmetics/catalog";
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
  const { data: activity } = useGroupActivityQuery(id);
  const myId = useAuth((s) => s.session?.user.id);
  const { data: sharedRewards } = useSharedRewardsQuery(id);
  const createRewardMutation = useCreateSharedReward(id);
  const contributeMutation = useContributeToReward(id);
  const [panelOpen, setPanelOpen] = useState(false);

  const canCreateReward = level >= SHARED_REWARD_CREATE_LEVEL;

  const memberIds = group?.members.map((m) => m.userId) ?? [];
  const streak = activity && group ? groupStreak(activity, memberIds, today()) : 0;
  const doneMap = new Map(
    (activity && group ? membersDoneToday(activity, memberIds, today()) : []).map((d) => [d.userId, d.done])
  );

  return (
    <View style={styles.root}>
      <Halftone color={theme.color.ink} opacity={0.1} id="groupdetail-bg" />
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
            {/* Group streak banner — ember, leads the screen (mock 04) */}
            <HardShadow style={styles.streakBanner}>
              <Text style={styles.streakEmoji}>{streak > 0 ? "🔥" : "🌱"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.streakNum}>
                  {streak > 0 ? `${streak}-DAY GROUP STREAK` : "NO GROUP STREAK YET"}
                </Text>
                <Text style={styles.streakSub}>
                  {streak > 0 ? "Everyone showed up — keep it alive." : "Everyone completes something today to start it."}
                </Text>
              </View>
            </HardShadow>

            {/* Invite code + share */}
            <HardShadow style={styles.codeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.codeLabel}>Invite code</Text>
                <Text style={styles.codeValue}>{group.inviteCode}</Text>
              </View>
              <HardShadow
                style={styles.shareBtn}
                onPress={() => Share.share({ message: `Join my Habiteer group "${group.name}" with code ${group.inviteCode}` })}
                aria-label="Share invite code"
              >
                <Text style={styles.shareText}>Share</Text>
              </HardShadow>
            </HardShadow>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Members</Text>
              <View style={styles.list}>
                {group.members.map((m) => {
                  const done = doneMap.get(m.userId) ?? false;
                  const label = m.userId === myId ? "You" : m.displayName;
                  const swatch = avatarColorFor(m.avatar);
                  return (
                    <View key={m.userId} style={styles.memberRow}>
                      <View style={[styles.memberAvatar, { backgroundColor: swatch.hex }]}>
                        <Text style={[styles.memberInitial, { color: swatch.textColor }]}>{label.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {label}
                      </Text>
                      <Text style={[styles.memberStatus, done ? styles.statusDone : styles.statusPending]}>
                        {done ? "✅ Today" : "⏳ Pending"}
                      </Text>
                    </View>
                  );
                })}
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
                    <Text style={styles.addPlus}>+</Text>
                    <Text style={styles.addText}>Add a shared reward</Text>
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

const INK = theme.color.ink;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.surface,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  title: { flex: 1, fontSize: 24, color: INK, fontFamily: fonts.heading, letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  error: { textAlign: "center", marginTop: 40, color: INK, opacity: 0.7 },

  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.ember,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 14,
    padding: 13,
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  streakEmoji: { fontSize: 32 },
  streakNum: { fontSize: 24, color: "#fff", fontFamily: fonts.heading, letterSpacing: 0.5 },
  streakSub: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.85)", fontFamily: fonts.mono700, marginTop: 1 },

  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  codeLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: "rgba(36,27,51,0.55)", fontFamily: fonts.mono700 },
  codeValue: { fontSize: 22, color: theme.color.hero, letterSpacing: 2, fontFamily: fonts.heading },
  shareBtn: {
    height: 36,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.hero,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 9,
  },
  shareText: { color: "#fff", fontWeight: "700", fontSize: 12, fontFamily: fonts.display700 },

  section: { gap: 8 },
  sectionTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: "rgba(36,27,51,0.6)", fontFamily: fonts.mono700 },
  list: { gap: 8 },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: theme.borders.hairline,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitial: { fontSize: 13, fontWeight: "700", fontFamily: fonts.display700 },
  memberName: { flex: 1, fontSize: 13, fontWeight: "700", color: INK, fontFamily: fonts.display700 },
  memberStatus: { fontSize: 12, fontWeight: "700", fontFamily: fonts.mono700 },
  statusDone: { color: theme.color.success },
  statusPending: { color: "rgba(36,27,51,0.5)" },

  hint: { fontSize: 12, fontWeight: "700", color: theme.color.ember, marginBottom: 4, fontFamily: fonts.mono700 },
  addBtn: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.color.hero,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  addBtnDisabled: { opacity: 0.4 },
  addPlus: { fontSize: 20, color: theme.color.hero, fontFamily: fonts.heading },
  addText: { fontWeight: "700", fontSize: 14, color: theme.color.hero, fontFamily: fonts.display700 },
});
