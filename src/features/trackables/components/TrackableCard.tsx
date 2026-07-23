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
    // Scheduled task: show its day (e.g. "Jul 30") unless it's today.
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
    .join(" · ");
}

/** Coin payout for completing right now — matches the design's per-card
 * preview, which shows only the coin payout, not XP (XP lives in the level bar). */
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
  /** Account-wide equipped card skin background; defaults to the plain white card. */
  skinBg?: string;
}) {
  const tint = DIFF_TINT[trackable.difficulty];
  const lightTint = DIFF_LIGHT_TINT[trackable.difficulty];
  const schedule = scheduleLabel(trackable);
  const framing = reductionFraming(trackable.goalType);
  const projectedStreak = status.isDoneToday ? status.streak : status.streak + 1;
  const projectedCombo = comboMultiplier(projectedStreak);

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
            <Text style={styles.pillText}>{trackable.difficulty}</Text>
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
            {framing.streakEmoji} {status.streak}
          </Text>
          {status.periodProgress && (
            <View style={styles.progressBadge}>
              <Text style={styles.progressText}>
                {status.periodProgress.completed}/{status.periodProgress.quota}{" "}
                {trackable.period === "week" ? "this wk" : "this mo"}
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
          onPress={
            status.isDoneToday ? undefined : (e) => onToggleComplete(e.nativeEvent.pageX, e.nativeEvent.pageY)
          }
          disabled={completing || status.isDoneToday}
          aria-label={status.isDoneToday ? `${trackable.name} done` : `Complete ${trackable.name}`}
        >
          <Check
            size={20}
            strokeWidth={3.4}
            color={status.isDoneToday ? theme.color.ink : "rgba(26,21,35,0.28)"}
          />
        </HardShadow>
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    paddingVertical: 13,
    paddingHorizontal: 14,
    position: "relative",
    overflow: "visible",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  cardDone: { opacity: 0.62 },
  stamp: {
    position: "absolute",
    top: -11,
    left: 14,
    backgroundColor: theme.color.jade,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 2,
    transform: [{ rotate: "-7deg" }],
    zIndex: 5,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  stampText: { fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 1, fontFamily: fonts.display700 },
  nameDone: { textDecorationLine: "line-through" },
  emojiBox: {
    width: 50,
    height: 50,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 26 },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontWeight: "600", fontSize: 16, color: theme.color.ink, flexShrink: 1, fontFamily: fonts.display600 },
  actions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" },
  pill: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.color.ink,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.mono700,
  },
  scheduleBadge: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: theme.color.paper,
  },
  scheduleText: { fontSize: 11, fontWeight: "600", color: theme.color.ink, fontFamily: fonts.display600 },
  reducePill: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: LIGHT_VIOLET,
  },
  reducePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.color.violet,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.mono700,
  },
  streakText: { fontSize: 12, fontWeight: "700", color: theme.color.fire, fontFamily: fonts.mono700 },
  progressBadge: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: theme.color.yellow,
  },
  progressText: { fontSize: 11, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.mono700 },
  comboBadge: {
    borderWidth: 2,
    borderColor: theme.color.violet,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: LIGHT_VIOLET,
  },
  comboText: { fontSize: 11, fontWeight: "700", color: theme.color.violet, fontFamily: fonts.mono700 },
  checkCol: { alignItems: "center", gap: 7, flexShrink: 0 },
  payout: { fontSize: 13, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.mono700 },
  checkBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  checkBtnDone: { backgroundColor: theme.color.jade, shadowOpacity: 0, elevation: 0 },
});
