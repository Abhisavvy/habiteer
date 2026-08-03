import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useTrackablesQuery } from "@/features/trackables/useTrackables";
import { useCompletionsQuery } from "@/features/completions/useCompletions";
import { today } from "@/features/trackables/today";
import { periodProgress } from "@/features/gamification/streak";
import { habitStats, coinsPerWeek, bestStreakHabit } from "@/features/stats/derived";
import { useGoalsQuery, useCreateGoal, useDeleteGoal } from "@/features/goals/useGoals";
import { goalStatus } from "@/features/goals/derived";
import { GoalPanel } from "@/features/goals/components/GoalPanel";
import type { Trackable } from "@/features/trackables/api";

export default function Stats() {
  const { data: trackables, isLoading: loadingTrackables } = useTrackablesQuery();
  const { data: completions, isLoading: loadingCompletions } = useCompletionsQuery();
  const { data: goals } = useGoalsQuery();
  const createGoalMutation = useCreateGoal();
  const deleteGoalMutation = useDeleteGoal();
  const [goalPanelFor, setGoalPanelFor] = useState<Trackable | null>(null);

  const isLoading = loadingTrackables || loadingCompletions;
  const allTrackables = trackables ?? [];
  const allCompletions = completions ?? [];
  const todayStr = today();
  const habits = allTrackables.filter((t) => t.kind === "habit");

  const best = bestStreakHabit(allTrackables, allCompletions, todayStr);
  const totalCoinsEarned = allCompletions.reduce((sum, c) => sum + c.coinsEarned, 0);
  const weeks = coinsPerWeek(allCompletions, todayStr, 8);
  const maxWeekCoins = Math.max(1, ...weeks.map((w) => w.coins));

  // Clears an ended (met/missed) goal before offering a fresh one — a "met"
  // goal's window often hasn't ENDED yet (met mid-window), and the DB's
  // exclusion constraint would reject a new overlapping goal on the same
  // habit otherwise. Safe for "missed" too (just a no-op extra round trip).
  const startNewGoal = (t: Trackable, oldGoalId: string) => {
    deleteGoalMutation.mutate(oldGoalId, { onSuccess: () => setGoalPanelFor(t) });
  };

  return (
    <View style={styles.root}>
      <Halftone color={theme.color.ink} opacity={0.1} id="stats-bg" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <HardShadow style={styles.backBtn} onPress={() => router.back()} aria-label="Back">
            <ArrowLeft size={18} strokeWidth={2.5} color={theme.color.ink} />
          </HardShadow>
          <Text style={styles.title}>STATS</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <>
            <View style={styles.recordsRow}>
              <HardShadow style={[styles.recordCard, { backgroundColor: theme.color.ember }]}>
                <Text style={styles.recordValue}>🔥 {best?.streak ?? 0}</Text>
                <Text style={styles.recordLabel} numberOfLines={1}>
                  {best ? `Record · ${best.name}` : "Record streak"}
                </Text>
              </HardShadow>
              <HardShadow style={[styles.recordCard, { backgroundColor: theme.color.success }]}>
                <Text style={styles.recordValue}>🪙 {totalCoinsEarned.toLocaleString()}</Text>
                <Text style={styles.recordLabel}>Coins earned</Text>
              </HardShadow>
            </View>

            <HardShadow style={styles.chartCard}>
              <Text style={styles.chartTitle}>Coins earned · last 8 weeks</Text>
              <View style={styles.chartBars}>
                {weeks.map((w) => {
                  const isPeak = w.coins === maxWeekCoins && w.coins > 0;
                  return (
                    <View key={w.weekStart} style={styles.chartBarCol}>
                      <View style={styles.chartBarTrack}>
                        <View
                          style={[
                            styles.chartBarFill,
                            { height: `${Math.max(4, (w.coins / maxWeekCoins) * 100)}%` },
                            { backgroundColor: isPeak ? theme.color.gold : theme.color.hero },
                          ]}
                        />
                      </View>
                      <Text style={styles.chartBarLabel}>{weekLabel(w.weekStart)}</Text>
                    </View>
                  );
                })}
              </View>
            </HardShadow>

            <Text style={styles.sectionLabel}>Per-habit</Text>
            {habits.length === 0 && <Text style={styles.emptyBody}>No habits yet.</Text>}
            <View style={styles.habitList}>
              {habits.map((t) => {
                const stats = habitStats(t, allCompletions, todayStr);
                // completionRate is only undefined for week/month-period habits
                // (day-period habits always get one from habitStats) — TrackablePanel
                // always sets an explicit period for habits (never null), so this branch
                // is only ever reached for a real "week"|"month" habit. Guarding on that
                // explicitly rather than `?? "week"` avoids silently mis-scoring a
                // day/null-period habit against a weekly quota it doesn't have, if that
                // invariant ever breaks (e.g. a future flow or a data-migration edge case).
                const period = t.period === "week" || t.period === "month"
                  ? periodProgress(
                      allCompletions.filter((c) => c.trackableId === t.id).map((c) => c.completedOn),
                      t.period,
                      t.quota,
                      todayStr
                    )
                  : null;
                const rate =
                  stats.completionRate !== undefined
                    ? stats.completionRate
                    : period && period.quota > 0
                      ? Math.min(1, period.completed / period.quota)
                      : 0;
                const pct = Math.round(rate * 100);
                const rateColor = rate >= 0.75 ? theme.color.success : rate >= 0.4 ? theme.color.gold : theme.color.ember;
                const goalRow = (goals ?? []).find((g) => g.trackableId === t.id);
                const gStatus = goalRow ? goalStatus(goalRow, allCompletions, todayStr) : null;
                return (
                  <View key={t.id} style={styles.habitRow}>
                    <View style={styles.habitTop}>
                      <Text style={styles.habitName} numberOfLines={1}>
                        {t.emoji} {t.name}
                      </Text>
                      <Text style={[styles.habitPct, { color: rateColor }]}>{pct}%</Text>
                    </View>
                    <View style={styles.habitTrack}>
                      <View style={[styles.habitFill, { width: `${Math.max(3, pct)}%`, backgroundColor: rateColor }]} />
                    </View>
                    <Text style={styles.habitMeta}>
                      🔥 {stats.currentStreak} now · {stats.longestStreak} best · 🪙 {stats.coinsEarned}
                    </Text>
                    <View style={styles.goalRow}>
                      {!gStatus ? (
                        <Pressable onPress={() => setGoalPanelFor(t)}>
                          <Text style={styles.goalLink}>🎯 Set a goal</Text>
                        </Pressable>
                      ) : gStatus.state === "met" ? (
                        <>
                          <Text style={styles.goalText}>
                            🎯 Goal met! {gStatus.progress}/{gStatus.goal.targetCount} 🎉
                          </Text>
                          <Pressable onPress={() => startNewGoal(t, gStatus.goal.id)}>
                            <Text style={styles.goalLink}>Set a new goal</Text>
                          </Pressable>
                        </>
                      ) : gStatus.state === "missed" ? (
                        <>
                          <Text style={styles.goalText}>
                            🎯 Goal ended · {gStatus.progress}/{gStatus.goal.targetCount}
                          </Text>
                          <Pressable onPress={() => startNewGoal(t, gStatus.goal.id)}>
                            <Text style={styles.goalLink}>Set a new goal</Text>
                          </Pressable>
                        </>
                      ) : (
                        <>
                          <Text style={styles.goalText}>
                            🎯 {gStatus.progress}/{gStatus.goal.targetCount} ·{" "}
                            {gStatus.state === "upcoming" ? "starts soon" : gStatus.onPace ? "on pace" : "behind pace"}
                          </Text>
                          <Pressable onPress={() => deleteGoalMutation.mutate(gStatus.goal.id)}>
                            <Text style={styles.goalRemove}>Remove</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {goalPanelFor && (
        <GoalPanel
          trackable={goalPanelFor}
          visible
          submitting={createGoalMutation.isPending}
          onCancel={() => setGoalPanelFor(null)}
          onSubmit={(values) => {
            createGoalMutation.mutate(values, {
              onSuccess: () => setGoalPanelFor(null),
              onError: (e: Error) => Alert.alert("Couldn't set that goal", e.message),
            });
          }}
        />
      )}
    </View>
  );
}

/** "Jan 5" for a week-start ISO date — short enough for 8 narrow bar-chart columns. */
function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  scroll: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 40, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    backgroundColor: theme.color.surface,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  title: { fontSize: 24, color: INK, fontFamily: fonts.heading, letterSpacing: 0.5 },

  recordsRow: { flexDirection: "row", gap: 9 },
  recordCard: {
    flex: 1,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    padding: 11,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  recordValue: { fontWeight: "700", fontSize: 22, color: "#fff", fontFamily: fonts.mono700 },
  recordLabel: { fontWeight: "700", fontSize: 10, color: "rgba(255,255,255,0.9)", fontFamily: fonts.display700, marginTop: 2 },

  chartCard: {
    backgroundColor: theme.color.surface,
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
  chartTitle: { fontWeight: "700", fontSize: 12, color: INK, fontFamily: fonts.display700, marginBottom: 12 },
  chartBars: { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 6 },
  chartBarCol: { flex: 1, alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" },
  chartBarTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  chartBarFill: { width: "100%", borderTopLeftRadius: 5, borderTopRightRadius: 5, borderWidth: 2, borderColor: INK },
  chartBarLabel: { fontSize: 8.5, fontWeight: "700", color: "rgba(36,27,51,0.5)", fontFamily: fonts.mono700 },

  sectionLabel: {
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(36,27,51,0.6)",
    fontFamily: fonts.mono700,
  },
  emptyBody: { fontSize: 12.5, color: "rgba(36,27,51,0.6)", fontFamily: fonts.display600 },
  habitList: { gap: 8 },
  habitRow: {
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 5,
  },
  habitTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  habitName: { flex: 1, fontWeight: "700", fontSize: 13, color: INK, fontFamily: fonts.display700 },
  habitPct: { fontWeight: "700", fontSize: 11, fontFamily: fonts.mono700 },
  habitTrack: {
    height: 9,
    backgroundColor: "#fff",
    borderWidth: theme.borders.hairline,
    borderColor: INK,
    borderRadius: 999,
    overflow: "hidden",
  },
  habitFill: { height: "100%" },
  habitMeta: { fontSize: 10.5, fontWeight: "700", color: "rgba(36,27,51,0.55)", fontFamily: fonts.mono700 },
  goalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 },
  goalText: { flex: 1, fontSize: 10.5, fontWeight: "700", color: theme.color.violet, fontFamily: fonts.mono700 },
  goalLink: { fontSize: 10.5, fontWeight: "700", color: theme.color.violet, fontFamily: fonts.mono700, textDecorationLine: "underline" },
  goalRemove: { fontSize: 10.5, fontWeight: "700", color: theme.color.ember, fontFamily: fonts.mono700, textDecorationLine: "underline" },
});
