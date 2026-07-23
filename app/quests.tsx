import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useCompletionsQuery } from "@/features/completions/useCompletions";
import { useQuestClaimsQuery, useClaimQuest } from "@/features/quests/useQuests";
import { activeQuestStatuses } from "@/features/quests/derived";
import { questCopy } from "@/features/quests/catalog";
import { today } from "@/features/trackables/today";
import { weekStart } from "@/features/gamification/dates";

function daysLeft(untilISO: string, todayISO: string): number {
  return Math.round((Date.parse(untilISO + "T00:00:00Z") - Date.parse(todayISO + "T00:00:00Z")) / 86400000);
}

export default function Quests() {
  const { data: completions, isLoading } = useCompletionsQuery();
  const { data: claims } = useQuestClaimsQuery();
  const claimMutation = useClaimQuest();

  const todayStr = today();
  const week = weekStart(todayStr);
  const statuses = activeQuestStatuses(completions ?? [], todayStr);
  const claimedThisWeek = new Set((claims ?? []).filter((c) => c.week === week).map((c) => c.questId));

  const onClaim = (questId: string) => {
    claimMutation.mutate(questId, { onError: (e: Error) => Alert.alert("Couldn't claim that", e.message) });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <HardShadow style={styles.backBtn} onPress={() => router.back()} aria-label="Back">
            <ArrowLeft size={18} strokeWidth={2.5} color={theme.color.ink} />
          </HardShadow>
          <Text style={styles.title}>Weekly Quests</Text>
        </View>
        <Text style={styles.subtitle}>Finish these before the week resets to bank the coins.</Text>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          statuses.map(({ quest, progress, goal, met }) => {
            const copy = questCopy(quest);
            const claimed = claimedThisWeek.has(quest.id);
            const pct = Math.max(0, Math.min(1, progress / goal));
            const isEvent = !!quest.activeUntil;
            const left = quest.activeUntil ? daysLeft(quest.activeUntil, todayStr) : 0;
            return (
              <HardShadow key={quest.id} style={[styles.card, isEvent && styles.cardEvent]}>
                <View style={styles.cardTop}>
                  <Text style={styles.emoji}>{copy.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.questTitle}>{copy.title}</Text>
                    <Text style={styles.blurb}>{copy.blurb}</Text>
                  </View>
                  {isEvent && (
                    <View style={styles.eventTag}>
                      <Text style={styles.eventTagText}>⚡ {left <= 0 ? "last day" : `${left}d left`}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct * 100}%` }, met && styles.fillMet]} />
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.progressText}>
                    {Math.min(progress, goal)} / {goal}
                  </Text>
                  <Text style={styles.reward}>+{quest.reward} 🪙</Text>
                </View>

                {claimed ? (
                  <View style={[styles.claimBtn, styles.claimedBtn]}>
                    <Text style={styles.claimedText}>Claimed ✓</Text>
                  </View>
                ) : met ? (
                  <HardShadow
                    style={styles.claimBtn}
                    disabled={claimMutation.isPending}
                    onPress={() => onClaim(quest.id)}
                  >
                    <Text style={styles.claimText}>Claim +{quest.reward} 🪙</Text>
                  </HardShadow>
                ) : (
                  <View style={[styles.claimBtn, styles.claimBtnLocked]}>
                    <Text style={styles.claimLockedText}>Keep going</Text>
                  </View>
                )}
              </HardShadow>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  scroll: { paddingHorizontal: 16, paddingTop: 54, paddingBottom: 40, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  title: { fontWeight: "800", fontSize: 22, color: theme.color.ink, fontFamily: fonts.display700 },
  subtitle: { fontSize: 13, color: "rgba(26,21,35,0.6)", fontFamily: fonts.display600, marginTop: -4 },
  card: {
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 15,
    gap: 11,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  cardEvent: { backgroundColor: "#FFF4D6" }, // warm tint marks the limited-time event
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 30 },
  questTitle: { fontWeight: "800", fontSize: 17, color: theme.color.ink, fontFamily: fonts.display700 },
  blurb: { fontSize: 12, color: "rgba(26,21,35,0.6)", fontFamily: fonts.display600, marginTop: 1 },
  eventTag: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: theme.color.yellow,
  },
  eventTagText: { fontWeight: "700", fontSize: 10, color: theme.color.ink, fontFamily: fonts.mono700 },
  track: {
    height: 12,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.color.ink,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.color.violet },
  fillMet: { backgroundColor: theme.color.jade },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressText: { fontWeight: "700", fontSize: 13, color: theme.color.ink, fontFamily: fonts.mono700 },
  reward: { fontWeight: "700", fontSize: 14, color: theme.color.ink, fontFamily: fonts.mono700 },
  claimBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.jade,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  claimText: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  claimedBtn: { backgroundColor: theme.color.jade, opacity: 0.55, shadowOpacity: 0, elevation: 0 },
  claimedText: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  claimBtnLocked: { backgroundColor: theme.color.paper, shadowOpacity: 0, elevation: 0 },
  claimLockedText: { fontWeight: "700", fontSize: 14, color: "rgba(26,21,35,0.45)", fontFamily: fonts.mono700 },
});
