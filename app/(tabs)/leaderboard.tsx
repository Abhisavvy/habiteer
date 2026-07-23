import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Share } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useAuth } from "@/features/auth/useAuth";
import { useLeaderboardQuery, useMyLeagueQuery, useSyncLeagueOnMount } from "@/features/leaderboard/useLeaderboard";
import { weekStart, type ISODate } from "@/features/gamification/dates";
import { LEAGUE_PROMOTE_TOP, LEAGUE_RELEGATE_BOTTOM, type LeagueTier } from "@/features/gamification/constants";

const MEDALS = ["🥇", "🥈", "🥉"];
const TOP3_AVATAR_BG = [theme.color.card, "#EDE7FF", "#D8F5EC"];

const TIER_COLORS: Record<LeagueTier, string> = {
  bronze: "#C58E4A",
  silver: "#AEB4C0",
  gold: theme.color.yellow,
  platinum: "#8FD9D0",
  diamond: theme.color.violet,
};
const TIER_TEXT_COLOR: Record<LeagueTier, string> = {
  bronze: "#fff",
  silver: theme.color.ink,
  gold: theme.color.ink,
  platinum: theme.color.ink,
  diamond: "#fff",
};

function resetCountdownLabel(): string {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10) as ISODate;
  const thisWeekStart = new Date(`${weekStart(todayIso)}T00:00:00Z`);
  const nextReset = new Date(thisWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const msLeft = Math.max(0, nextReset.getTime() - now.getTime());
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `resets ${days}d ${hours}h`;
}

export default function Leaderboard() {
  const userId = useAuth((s) => s.session?.user.id);
  const { data: rows, isLoading, error } = useLeaderboardQuery();
  const { data: myTier } = useMyLeagueQuery();
  useSyncLeagueOnMount();

  const activeCount = rows?.filter((r) => r.weeklyXp > 0).length ?? 0;
  const relegateZoneStart = Math.max(activeCount - LEAGUE_RELEGATE_BOTTOM, LEAGUE_RELEGATE_BOTTOM);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>This week</Text>
          {myTier && (
            <HardShadow style={[styles.tierBadge, { backgroundColor: TIER_COLORS[myTier] }]}>
              <Text style={[styles.tierBadgeText, { color: TIER_TEXT_COLOR[myTier] }]}>{myTier.toUpperCase()}</Text>
            </HardShadow>
          )}
        </View>
        <Text style={styles.resetBadge}>{resetCountdownLabel()}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load the leaderboard. Pull to retry.</Text>}

        {activeCount > relegateZoneStart && (
          <Text style={styles.zoneHint}>
            Top {LEAGUE_PROMOTE_TOP} promote next week · bottom {activeCount - relegateZoneStart} relegate
          </Text>
        )}

        <View style={styles.list}>
          {rows?.map((row, i) => {
            const rank = i + 1;
            const isYou = row.id === userId;
            const isTop3 = rank <= 3;
            const isRelegateZone = row.weeklyXp > 0 && rank > relegateZoneStart && rank <= activeCount;
            const initial = (isYou ? "You" : row.displayName).charAt(0).toUpperCase();

            if (isTop3) {
              const fill = isYou ? theme.color.violet : rank === 1 ? theme.color.yellow : theme.color.card;
              const textColor = isYou ? "#fff" : theme.color.ink;
              return (
                <HardShadow
                  key={row.id}
                  style={[
                    styles.topRow,
                    rank === 1 ? styles.topRowFirst : styles.topRowRest,
                    { backgroundColor: fill },
                  ]}
                >
                  <Text style={rank === 1 ? styles.medalFirst : styles.medalRest}>{MEDALS[rank - 1]}</Text>
                  <View
                    style={[
                      rank === 1 ? styles.avatarFirst : styles.avatarRest,
                      { backgroundColor: isYou ? theme.color.yellow : TOP3_AVATAR_BG[rank - 1] },
                    ]}
                  >
                    <Text style={rank === 1 ? styles.avatarTextFirst : styles.avatarTextRest}>{initial}</Text>
                  </View>
                  <Text style={[rank === 1 ? styles.nameFirst : styles.nameRest, { color: textColor }]} numberOfLines={1}>
                    {isYou ? "You" : row.displayName}
                  </Text>
                  <Text style={[rank === 1 ? styles.scoreFirst : styles.scoreRest, { color: textColor }]}>
                    {row.weeklyXp.toLocaleString()}
                  </Text>
                </HardShadow>
              );
            }

            if (isYou) {
              return (
                <HardShadow key={row.id} style={[styles.youRow, isRelegateZone && styles.relegateBorder]}>
                  <Text style={styles.youRank}>{rank}</Text>
                  <View style={[styles.youAvatar, { backgroundColor: theme.color.yellow }]}>
                    <Text style={styles.youAvatarText}>{initial}</Text>
                  </View>
                  <Text style={styles.youName} numberOfLines={1}>
                    You
                  </Text>
                  {isRelegateZone && <Text style={styles.relegateTag}>↓</Text>}
                  <Text style={styles.youScore}>{row.weeklyXp.toLocaleString()}</Text>
                </HardShadow>
              );
            }

            return (
              <View key={row.id} style={[styles.plainRow, isRelegateZone && styles.relegateBorder]}>
                <Text style={styles.plainRank}>{rank}</Text>
                <View style={styles.plainAvatar}>
                  <Text style={styles.plainAvatarText}>{initial}</Text>
                </View>
                <Text style={styles.plainName} numberOfLines={1}>
                  {row.displayName}
                </Text>
                {isRelegateZone && <Text style={styles.relegateTag}>↓</Text>}
                <Text style={styles.plainScore}>{row.weeklyXp.toLocaleString()}</Text>
              </View>
            );
          })}
        </View>

        {rows && rows.length === 0 && (
          <Text style={styles.note}>No one's earned XP this week yet — be the first.</Text>
        )}

        {rows && rows.length > 0 && rows.length < 10 ? (
          <View style={styles.lowPop}>
            <Text style={styles.lowPopEmoji}>🌱</Text>
            <Text style={styles.lowPopTitle}>
              You're rank #{rows.findIndex((r) => r.id === userId) + 1} of {rows.length}
            </Text>
            <Text style={styles.lowPopBody}>Early days — invite a friend to make the climb count.</Text>
            <HardShadow
              style={styles.lowPopBtn}
              onPress={() => Share.share({ message: "Join me on Habiteer — level up your habits!" })}
            >
              <Text style={styles.lowPopBtnText}>＋ Invite friends</Text>
            </HardShadow>
          </View>
        ) : (
          <Text style={styles.note}>Finish habits today to climb. Ranks reset every week.</Text>
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
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: "800", color: theme.color.ink, fontFamily: fonts.display700 },
  tierBadge: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tierBadgeText: { fontWeight: "700", fontSize: 11, fontFamily: fonts.mono700, letterSpacing: 0.5 },
  zoneHint: { fontSize: 11, fontWeight: "600", color: "rgba(26,21,35,0.5)", fontFamily: fonts.mono700, marginTop: -6 },
  relegateBorder: { borderColor: theme.color.fire, borderBottomColor: theme.color.fire },
  relegateTag: { fontWeight: "700", fontSize: 13, color: theme.color.fire, marginRight: 2 },
  resetBadge: {
    fontWeight: "700",
    fontSize: 12,
    color: theme.color.fire,
    backgroundColor: "#FFDBD1",
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: fonts.mono700,
  },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  list: { gap: 10 },

  topRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: theme.border, borderColor: theme.color.ink, borderRadius: 13 },
  topRowFirst: {
    padding: 14,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  topRowRest: {
    padding: 12,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  medalFirst: { fontSize: 26 },
  medalRest: { fontSize: 23 },
  avatarFirst: { width: 40, height: 40, borderRadius: 20, borderWidth: theme.border, borderColor: theme.color.ink, alignItems: "center", justifyContent: "center" },
  avatarRest: { width: 36, height: 36, borderRadius: 18, borderWidth: theme.border, borderColor: theme.color.ink, alignItems: "center", justifyContent: "center" },
  avatarTextFirst: { fontWeight: "700", fontSize: 16, color: theme.color.ink, fontFamily: fonts.display700 },
  avatarTextRest: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  nameFirst: { flex: 1, fontWeight: "700", fontSize: 17, fontFamily: fonts.display700 },
  nameRest: { flex: 1, fontWeight: "700", fontSize: 16, fontFamily: fonts.display700 },
  scoreFirst: { fontWeight: "700", fontSize: 16, fontFamily: fonts.mono700 },
  scoreRest: { fontWeight: "700", fontSize: 15, fontFamily: fonts.mono700 },

  youRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.violet,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 13,
    padding: 13,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  youRank: { width: 26, textAlign: "center", fontWeight: "700", fontSize: 15, color: "#fff", fontFamily: fonts.mono700 },
  youAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: theme.border, borderColor: theme.color.ink, alignItems: "center", justifyContent: "center" },
  youAvatarText: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  youName: { flex: 1, fontWeight: "700", fontSize: 16, color: "#fff", fontFamily: fonts.display700 },
  youScore: { fontWeight: "700", fontSize: 15, color: "#fff", fontFamily: fonts.mono700 },

  plainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(26,21,35,0.1)",
  },
  plainRank: { width: 26, textAlign: "center", fontWeight: "700", fontSize: 14, color: "rgba(26,21,35,0.5)", fontFamily: fonts.mono700 },
  plainAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: theme.color.ink, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  plainAvatarText: { fontWeight: "700", fontSize: 14, color: theme.color.ink, fontFamily: fonts.display700 },
  plainName: { flex: 1, fontWeight: "600", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display600 },
  plainScore: { fontWeight: "700", fontSize: 14, color: "rgba(26,21,35,0.6)", fontFamily: fonts.mono700 },

  error: { textAlign: "center", marginTop: 40, color: theme.color.ink, opacity: 0.7 },
  note: { fontSize: 12, fontWeight: "600", color: theme.color.ink, opacity: 0.6, lineHeight: 18 },

  lowPop: {
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    backgroundColor: theme.color.paper,
  },
  lowPopEmoji: { fontSize: 30 },
  lowPopTitle: { fontWeight: "700", fontSize: 15, color: theme.color.ink, marginTop: 4, fontFamily: fonts.display700 },
  lowPopBody: { fontSize: 12, lineHeight: 18, color: theme.color.ink, opacity: 0.6, marginTop: 4, textAlign: "center" },
  lowPopBtn: {
    marginTop: 10,
    height: 40,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: theme.color.violet,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  lowPopBtnText: { color: "#fff", fontWeight: "700", fontSize: 13, fontFamily: fonts.display700 },
});
