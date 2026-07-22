import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Trophy } from "lucide-react-native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useAuth } from "@/features/auth/useAuth";
import { useLeaderboardQuery } from "@/features/leaderboard/useLeaderboard";

export default function Leaderboard() {
  const userId = useAuth((s) => s.session?.user.id);
  const { data: rows, isLoading, error } = useLeaderboardQuery();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>THIS WEEK</Text>
        <View style={styles.statBadge}>
          <Trophy size={13} strokeWidth={3} color={theme.color.ink} />
          <Text style={styles.statText}>weekly XP</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load the leaderboard. Pull to retry.</Text>}

        <View style={styles.list}>
          {rows?.map((row, i) => {
            const isYou = row.id === userId;
            return (
              <View key={row.id} style={[styles.row, isYou && styles.rowYou]}>
                <Text style={styles.rank}>{i + 1}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {isYou ? "You" : row.displayName}
                </Text>
                <Text style={styles.xp}>{row.weeklyXp.toLocaleString()}</Text>
              </View>
            );
          })}
        </View>

        {rows && rows.length === 0 && (
          <Text style={styles.note}>No one's earned XP this week yet — be the first.</Text>
        )}
        <Text style={styles.note}>Finish habits today to climb. Ranks reset every week.</Text>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.color.card,
  },
  statText: { fontWeight: "700", fontSize: 12, color: theme.color.ink },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 12,
  },
  rowYou: { backgroundColor: theme.color.yellow },
  rank: { fontWeight: "700", fontSize: 15, color: theme.color.ink, width: 22, fontFamily: fonts.mono700 },
  name: { fontWeight: "700", fontSize: 15, color: theme.color.ink, flex: 1, fontFamily: fonts.display600 },
  xp: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.mono700 },
  error: { textAlign: "center", marginTop: 40, color: theme.color.ink, opacity: 0.7 },
  note: { fontSize: 12, fontWeight: "600", color: theme.color.ink, opacity: 0.6, lineHeight: 18 },
});
