import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Share } from "react-native";
import { router } from "expo-router";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useAuth } from "@/features/auth/useAuth";
import { useLeaderboardQuery, useMyLeagueQuery, useSyncLeagueOnMount } from "@/features/leaderboard/useLeaderboard";
import { weekStart, type ISODate } from "@/features/gamification/dates";
import { LEAGUE_PROMOTE_TOP, LEAGUE_RELEGATE_BOTTOM, type LeagueTier } from "@/features/gamification/constants";
import { avatarColorFor, titleFor } from "@/features/cosmetics/catalog";

const TIER_COLORS: Record<LeagueTier, string> = {
  bronze: "#C58E4A",
  silver: "#AEB4C0",
  gold: theme.color.gold,
  platinum: "#8FD9D0",
  diamond: theme.color.hero,
};
const TIER_TEXT_COLOR: Record<LeagueTier, string> = {
  bronze: "#fff",
  silver: theme.color.ink,
  gold: theme.color.ink,
  platinum: theme.color.ink,
  diamond: "#fff",
};
const TIER_MEDAL: Record<LeagueTier, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "🏆",
  diamond: "💎",
};

/** Time left until the weekly reset, as a compact "3d 4h". */
function timeLeftLabel(): string {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10) as ISODate;
  const thisWeekStart = new Date(`${weekStart(todayIso)}T00:00:00Z`);
  const nextReset = new Date(thisWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const msLeft = Math.max(0, nextReset.getTime() - now.getTime());
  const days = Math.floor(msLeft / (24 * 60 * 60 * 1000));
  const hours = Math.floor((msLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

export default function Leaderboard() {
  const userId = useAuth((s) => s.session?.user.id);
  const { data: rows, isLoading, error } = useLeaderboardQuery();
  const { data: myTier } = useMyLeagueQuery();
  useSyncLeagueOnMount();

  const tier: LeagueTier = myTier ?? "bronze";
  const activeCount = rows?.filter((r) => r.weeklyXp > 0).length ?? 0;
  const relegateZoneStart = Math.max(activeCount - LEAGUE_RELEGATE_BOTTOM, LEAGUE_RELEGATE_BOTTOM);
  const showZones = activeCount > relegateZoneStart;

  // Walk the ranked rows once, emitting zone labels as we cross into them.
  const rowEls: React.ReactNode[] = [];
  let emittedRelegateLabel = false;
  (rows ?? []).forEach((row, i) => {
    const rank = i + 1;
    const isYou = row.id === userId;
    const isPromote = showZones && row.weeklyXp > 0 && rank <= LEAGUE_PROMOTE_TOP;
    const isRelegate = showZones && row.weeklyXp > 0 && rank > relegateZoneStart && rank <= activeCount;
    if (i === 0 && showZones) {
      rowEls.push(
        <Text key="promo-label" style={[styles.zoneLabel, { color: theme.color.success }]}>
          ⬆ Promotion zone
        </Text>
      );
    }
    if (isRelegate && !emittedRelegateLabel) {
      emittedRelegateLabel = true;
      rowEls.push(
        <Text key="releg-label" style={[styles.zoneLabel, { color: theme.color.danger }]}>
          ⬇ Relegation zone
        </Text>
      );
    }

    const swatch = avatarColorFor(row.avatarColor);
    const initial = (isYou ? "You" : row.displayName).charAt(0).toUpperCase();
    const equippedTitle = row.titleId !== "novice" ? titleFor(row.titleId) : null;
    const elevated = isPromote || isYou; // mock: promotion rows + you carry the hard shadow
    const Wrap = elevated ? HardShadow : View;

    rowEls.push(
      <Wrap
        key={row.id}
        style={[
          styles.rankRow,
          elevated && styles.rankRowElevated,
          isYou && styles.youRow,
          isRelegate && styles.relegateRow,
        ]}
      >
        <Text style={[styles.rank, isYou && styles.youInk]}>{rank}</Text>
        <View style={[styles.avatar, { backgroundColor: swatch.hex }]}>
          <Text style={[styles.avatarText, { color: swatch.textColor }]}>{initial}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={[styles.name, isYou && styles.youInk]} numberOfLines={1}>
            {isYou ? "You" : row.displayName}
          </Text>
          {equippedTitle && (
            <Text style={[styles.rowTitle, isYou && styles.youTitle]} numberOfLines={1}>
              {equippedTitle.label}
            </Text>
          )}
        </View>
        {isRelegate && <Text style={styles.relegateTag}>↓</Text>}
        <Text style={[styles.score, isYou && styles.youInk]}>{row.weeklyXp.toLocaleString()}</Text>
      </Wrap>
    );
  });

  return (
    <View style={styles.root}>
      <Halftone color={theme.color.ink} opacity={0.1} id="board-bg" />
      <View style={styles.header}>
        <Text style={styles.title}>LEAGUE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load the leaderboard. Pull to retry.</Text>}

        {/* League banner (mock 03) — hero-violet with a white halftone "sun" */}
        <HardShadow style={styles.banner}>
          <Halftone color="#FFFFFF" opacity={0.45} id="league-sun" />
          <View style={[styles.bannerMedal, { backgroundColor: TIER_COLORS[tier] }]}>
            <Text style={styles.bannerMedalEmoji}>{TIER_MEDAL[tier]}</Text>
          </View>
          <View style={styles.bannerBody}>
            <Text style={styles.bannerTier}>{tier.toUpperCase()} LEAGUE</Text>
            <Text style={styles.bannerSub}>
              {timeLeftLabel()} left · top {LEAGUE_PROMOTE_TOP} promote
            </Text>
          </View>
        </HardShadow>

        <View style={styles.list}>{rowEls}</View>

        {rows && rows.length === 0 && (
          <Text style={styles.note}>No one's earned XP this week yet — be the first.</Text>
        )}

        {rows && rows.length > 0 && rows.length < 10 && (
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
        )}

        <HardShadow style={styles.questsLink} onPress={() => router.push("/quests")} aria-label="Open weekly quests">
          <Text style={styles.questsEmoji}>🎯</Text>
          <Text style={styles.questsLinkText}>Weekly quests</Text>
          <Text style={styles.questsLinkArrow}>›</Text>
        </HardShadow>
      </ScrollView>
    </View>
  );
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  header: { paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12 },
  title: { fontSize: 26, color: INK, letterSpacing: 0.5, fontFamily: fonts.heading },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 12 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.hero,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 14,
    padding: 12,
    overflow: "hidden",
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  bannerMedal: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerMedalEmoji: { fontSize: 26 },
  bannerBody: { flex: 1 },
  bannerTier: { fontSize: 20, color: "#fff", fontFamily: fonts.heading, letterSpacing: 0.5 },
  bannerSub: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.8)", fontFamily: fonts.mono700, marginTop: 1 },

  zoneLabel: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, fontFamily: fonts.display700, marginTop: 4 },

  list: { gap: 8 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  rankRowElevated: {
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  youRow: { backgroundColor: "#EDE7FF", borderColor: theme.color.hero },
  relegateRow: { borderColor: theme.color.danger },
  youInk: { color: theme.color.hero },
  rank: { width: 20, fontSize: 14, fontWeight: "700", color: INK, fontFamily: fonts.mono700 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: theme.borders.hairline,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", fontFamily: fonts.display700 },
  identity: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "700", color: INK, fontFamily: fonts.display700 },
  rowTitle: { fontSize: 10, fontWeight: "600", color: "rgba(36,27,51,0.55)", fontFamily: fonts.display600, marginTop: 1 },
  youTitle: { color: "rgba(107,62,240,0.7)" },
  relegateTag: { fontSize: 13, fontWeight: "700", color: theme.color.danger, marginRight: 2 },
  score: { fontSize: 13, fontWeight: "700", color: theme.color.hero, fontFamily: fonts.mono700 },

  error: { textAlign: "center", marginTop: 40, color: INK, opacity: 0.7 },
  note: { fontSize: 12, fontWeight: "600", color: INK, opacity: 0.6, lineHeight: 18 },

  lowPop: {
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    backgroundColor: theme.color.surface,
  },
  lowPopEmoji: { fontSize: 30 },
  lowPopTitle: { fontWeight: "700", fontSize: 15, color: INK, marginTop: 4, fontFamily: fonts.display700 },
  lowPopBody: { fontSize: 12, lineHeight: 18, color: INK, opacity: 0.6, marginTop: 4, textAlign: "center" },
  lowPopBtn: {
    marginTop: 10,
    height: 40,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: theme.color.hero,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 10,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  lowPopBtnText: { color: "#fff", fontWeight: "700", fontSize: 13, fontFamily: fonts.display700 },

  questsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: theme.color.gold,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  questsEmoji: { fontSize: 18 },
  questsLinkText: { flex: 1, fontWeight: "700", fontSize: 13, color: INK, fontFamily: fonts.display700 },
  questsLinkArrow: { fontWeight: "700", fontSize: 18, color: INK, fontFamily: fonts.display700 },
});
