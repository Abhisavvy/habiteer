import { View, Text, Pressable, StyleSheet } from "react-native";
import { Pencil, X, Check } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { taskCoins } from "@/features/gamification/coins";
import { comboMultiplier } from "@/features/gamification/combo";
import { DIFF_TINT, DIFF_LIGHT_TINT, LIGHT_VIOLET, reductionFraming } from "../constants";
import { today } from "../today";
import type { Trackable } from "../api";
import type { TrackableStatus } from "@/features/completions/derived";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function scheduleLabel(t: Trackable): string {
  if (t.kind !== "habit") {
    if (t.dueOn && t.dueOn !== today()) {
      return new Date(t.dueOn + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    }
    return "Today";
  }
  if (t.period === "week") return `Weekly ×${t.quota}`;
  if (t.period === "month") return t.quota > 1 ? `Monthly ×${t.quota}` : "Monthly";
  if (!t.weekdays || t.weekdays.length === 0) return "Daily";
  return t.weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join("·");
}

function payoutCoins(t: Trackable): number {
  return t.kind === "task" ? taskCoins(t.difficulty) : t.coinValue;
}

export function TrackableCard({
  trackable,
  status,
  onEdit,
  onArchive,
  onToggleComplete,
  completing,
  skinBg,
}: {
  trackable: Trackable;
  status: TrackableStatus;
  onEdit: () => void;
  onArchive: () => void;
  onToggleComplete: (pageX: number, pageY: number) => void;
  completing?: boolean;
  skinBg?: string;
}) {
  const tint = DIFF_TINT[trackable.difficulty];
  const lightTint = DIFF_LIGHT_TINT[trackable.difficulty];
  const schedule = scheduleLabel(trackable);
  const framing = reductionFraming(trackable.goalType);
  const projectedStreak = status.isDoneToday ? status.streak : status.streak + 1;
  const projectedCombo = comboMultiplier(projectedStreak);
  const pillOnInk = trackable.difficulty === "medium"; // gold pill → ink text; ember/jade → white

  return (
    <HardShadow style={[styles.card, skinBg ? { backgroundColor: skinBg } : null, status.isDoneToday && styles.cardDone]}>
      {status.isDoneToday && (
        <HardShadow style={styles.stamp} pointerEvents="none">
          <Text style={styles.stampText}>{framing.doneStamp}</Text>
        </HardShadow>
      )}
      <View style={[styles.emojiBox, { backgroundColor: lightTint }]}>
        <Text style={styles.emoji}>{trackable.emoji}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.name, status.isDoneToday && styles.nameDone]} numberOfLines={1}>
            {trackable.name}
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.iconBtn} onPress={onEdit} aria-label={`Edit ${trackable.name}`}>
              <Pencil size={14} strokeWidth={3} color={theme.color.ink} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={onArchive} aria-label={`Archive ${trackable.name}`}>
              <X size={14} strokeWidth={3} color={theme.color.ink} />
            </Pressable>
          </View>
        </View>
        <View style={styles.metaRow}>
          <View style={[styles.pill, { backgroundColor: tint }]}>
            <Text style={[styles.pillText, pillOnInk ? styles.pillTextInk : styles.pillTextLight]}>{trackable.difficulty}</Text>
          </View>
          {framing.pill && (
            <View style={styles.reducePill}>
              <Text style={styles.reducePillText}>{framing.pill}</Text>
            </View>
          )}
          <View style={styles.scheduleBadge}>
            <Text style={styles.scheduleText}>{schedule}</Text>
          </View>
          <Text style={styles.streakText}>
            {framing.streakEmoji}
            {status.streak}
          </Text>
          {status.periodProgress && (
            <View style={styles.progressBadge}>
              <Text style={styles.progressText}>
                {status.periodProgress.completed}/{status.periodProgress.quota} {trackable.period === "week" ? "wk" : "mo"}
              </Text>
            </View>
          )}
          {projectedCombo > 1 && (
            <View style={styles.comboBadge}>
              <Text style={styles.comboText}>×{projectedCombo}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.checkCol}>
        <Text style={styles.payout}>+{payoutCoins(trackable)}🪙</Text>
        <HardShadow
          style={[styles.checkBtn, status.isDoneToday && styles.checkBtnDone]}
          onPress={status.isDoneToday ? undefined : (e) => onToggleComplete(e.nativeEvent.pageX, e.nativeEvent.pageY)}
          disabled={completing || status.isDoneToday}
          aria-label={status.isDoneToday ? `${trackable.name} done` : `Complete ${trackable.name}`}
        >
          <Check size={22} strokeWidth={3.6} color={status.isDoneToday ? "#fff" : "rgba(36,27,51,0.3)"} />
        </HardShadow>
      </View>
    </HardShadow>
  );
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: theme.color.card,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
    position: "relative",
    overflow: "visible",
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  cardDone: { opacity: 0.72 },
  stamp: {
    position: "absolute",
    top: -11,
    left: 12,
    backgroundColor: theme.color.success,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 1,
    transform: [{ rotate: "-7deg" }],
    zIndex: 5,
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  stampText: { fontSize: 13, color: "#fff", letterSpacing: 1, fontFamily: fonts.heading },
  nameDone: { textDecorationLine: "line-through" },
  emojiBox: {
    width: 46,
    height: 46,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 23 },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontWeight: "700", fontSize: 15, color: INK, flexShrink: 1, fontFamily: fonts.display700 },
  actions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5, flexWrap: "wrap" },
  pill: { borderWidth: theme.borders.hairline, borderColor: INK, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  pillText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3, fontFamily: fonts.display700 },
  pillTextInk: { color: INK },
  pillTextLight: { color: "#fff" },
  scheduleBadge: {
    borderWidth: theme.borders.hairline,
    borderColor: INK,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: theme.color.paper,
  },
  scheduleText: { fontSize: 10, fontWeight: "600", color: INK, fontFamily: fonts.display600 },
  reducePill: {
    borderWidth: theme.borders.hairline,
    borderColor: theme.color.hero,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: LIGHT_VIOLET,
  },
  reducePillText: { fontSize: 9, fontWeight: "800", color: theme.color.hero, textTransform: "uppercase", letterSpacing: 0.3, fontFamily: fonts.display700 },
  streakText: { fontSize: 11, fontWeight: "700", color: theme.color.ember, fontFamily: fonts.mono700 },
  progressBadge: {
    borderWidth: theme.borders.hairline,
    borderColor: INK,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: theme.color.gold,
  },
  progressText: { fontSize: 10, fontWeight: "700", color: INK, fontFamily: fonts.mono700 },
  comboBadge: { borderWidth: theme.borders.hairline, borderColor: theme.color.hero, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: LIGHT_VIOLET },
  comboText: { fontSize: 10, fontWeight: "700", color: theme.color.hero, fontFamily: fonts.mono700 },
  checkCol: { alignItems: "center", gap: 5, flexShrink: 0 },
  payout: { fontSize: 12, fontWeight: "700", color: INK, fontFamily: fonts.mono700 },
  checkBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  checkBtnDone: { backgroundColor: theme.color.success, shadowOpacity: 0, elevation: 0 },
});
