import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useTrackablesQuery } from "@/features/trackables/useTrackables";
import { useCompletionsQuery } from "@/features/completions/useCompletions";
import { today } from "@/features/trackables/today";
import { periodProgress } from "@/features/gamification/streak";
import { habitStats, coinsPerWeek, bestStreakHabit } from "@/features/stats/derived";

export default function Stats() {
  const { data: trackables, isLoading: loadingTrackables } = useTrackablesQuery();
  const { data: completions, isLoading: loadingCompletions } = useCompletionsQuery();

  const isLoading = loadingTrackables || loadingCompletions;
  const allTrackables = trackables ?? [];
  const allCompletions = completions ?? [];
  const todayStr = today();
  const habits = allTrackables.filter((t) => t.kind === "habit");

  const best = bestStreakHabit(allTrackables, allCompletions, todayStr);
  const totalCoinsEarned = allCompletions.reduce((sum, c) => sum + c.coinsEarned, 0);
  const weeks = coinsPerWeek(allCompletions, todayStr, 8);
  const maxWeekCoins = Math.max(1, ...weeks.map((w) => w.coins));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <HardShadow style={styles.backBtn} onPress={() => router.back()} aria-label="Back">
            <ArrowLeft size={18} strokeWidth={2.5} color={theme.color.ink} />
          </HardShadow>
          <Text style={styles.title}>Stats</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <>
            <View style={styles.recordsRow}>
              <HardShadow style={styles.recordHero}>
                {best ? (
                  <>
                    <Text style={styles.recordHeroEmoji}>{best.emoji}</Text>
                    <Text style={styles.recordHeroValue}>{best.streak} 🔥</Text>
                    <Text style={styles.recordHeroLabel} numberOfLines={1}>
                      {best.name}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.recordHeroEmpty}>No streaks yet — complete a habit to start one.</Text>
                )}
              </HardShadow>
              <View style={styles.recordCol}>
                <HardShadow style={styles.recordCell}>
                  <Text style={styles.recordValue}>🪙 {totalCoinsEarned.toLocaleString()}</Text>
                  <Text style={styles.recordLabel}>Coins earned all-time</Text>
                </HardShadow>
                <HardShadow style={styles.recordCell}>
                  <Text style={[styles.recordValue, { color: theme.color.jade }]}>{allCompletions.length}</Text>
                  <Text style={styles.recordLabel}>Habits &amp; tasks done</Text>
                </HardShadow>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Coins earned — last 8 weeks</Text>
            <HardShadow style={styles.chartCard}>
              <View style={styles.chartBars}>
                {weeks.map((w) => (
                  <View key={w.weekStart} style={styles.chartBarCol}>
                    <View style={styles.chartBarTrack}>
                      <View style={[styles.chartBarFill, { height: `${Math.max(4, (w.coins / maxWeekCoins) * 100)}%` }]} />
                    </View>
                    <Text style={styles.chartBarLabel}>{weekLabel(w.weekStart)}</Text>
                  </View>
                ))}
              </View>
            </HardShadow>

            <Text style={styles.sectionLabel}>Per-habit</Text>
            {habits.length === 0 && <Text style={styles.emptyBody}>No habits yet.</Text>}
            <View style={styles.habitList}>
              {habits.map((t) => {
                const stats = habitStats(t, allCompletions, todayStr);
                const period = periodProgress(
                  allCompletions.filter((c) => c.trackableId === t.id).map((c) => c.completedOn),
                  (t.period as "week" | "month") ?? "week",
                  t.quota,
                  todayStr
                );
                return (
                  <HardShadow key={t.id} style={styles.habitRow}>
                    <Text style={styles.habitEmoji}>{t.emoji}</Text>
                    <View style={styles.habitBody}>
                      <Text style={styles.habitName} numberOfLines={1}>
                        {t.name}
                      </Text>
                      <Text style={styles.habitMeta}>
                        🔥 {stats.currentStreak} now · {stats.longestStreak} best
                        {stats.completionRate !== undefined
                          ? ` · ${Math.round(stats.completionRate * 100)}% done`
                          : t.period !== "day"
                            ? ` · ${period.completed}/${period.quota} this ${t.period}`
                            : ""}
                      </Text>
                    </View>
                    <Text style={styles.habitCoins}>🪙 {stats.coinsEarned}</Text>
                  </HardShadow>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** "Jan 5" for a week-start ISO date — short enough for 8 narrow bar-chart columns. */
function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  scroll: { paddingHorizontal: 16, paddingTop: 54, paddingBottom: 40, gap: 15 },
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
  recordsRow: { flexDirection: "row", gap: 11 },
  recordHero: {
    flex: 1,
    backgroundColor: theme.color.violet,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 15,
    justifyContent: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  recordHeroEmoji: { fontSize: 30 },
  recordHeroValue: { fontWeight: "800", fontSize: 22, color: "#fff", fontFamily: fonts.mono700, marginTop: 4 },
  recordHeroLabel: { fontWeight: "600", fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: fonts.display600, marginTop: 2 },
  recordHeroEmpty: { fontSize: 12.5, lineHeight: 18, color: "#fff", fontFamily: fonts.display600 },
  recordCol: { gap: 11, width: "42%" },
  recordCell: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 13,
    padding: 11,
    justifyContent: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  recordValue: { fontWeight: "700", fontSize: 16, color: theme.color.ink, fontFamily: fonts.mono700 },
  recordLabel: { fontWeight: "600", fontSize: 10, color: "rgba(26,21,35,0.6)", fontFamily: fonts.display600, marginTop: 2 },
  sectionLabel: {
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(26,21,35,0.5)",
    fontFamily: fonts.mono700,
    marginTop: -4,
  },
  chartCard: {
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 13,
    padding: 14,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  chartBars: { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 6 },
  chartBarCol: { flex: 1, alignItems: "center", gap: 5, height: "100%", justifyContent: "flex-end" },
  chartBarTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  chartBarFill: { width: "100%", backgroundColor: theme.color.jade, borderRadius: 4, borderWidth: 2, borderColor: theme.color.ink },
  chartBarLabel: { fontSize: 8.5, color: "rgba(26,21,35,0.55)", fontFamily: fonts.mono700 },
  emptyBody: { fontSize: 12.5, color: "rgba(26,21,35,0.6)", fontFamily: fonts.display600 },
  habitList: { gap: 10 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 13,
    padding: 12,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  habitEmoji: { fontSize: 24 },
  habitBody: { flex: 1, minWidth: 0 },
  habitName: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  habitMeta: { fontSize: 11, color: "rgba(26,21,35,0.6)", fontFamily: fonts.mono700, marginTop: 2 },
  habitCoins: { fontWeight: "700", fontSize: 13, color: theme.color.ink, fontFamily: fonts.mono700 },
});
