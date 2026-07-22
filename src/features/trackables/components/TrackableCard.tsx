import { View, Text, Pressable, StyleSheet } from "react-native";
import { Pencil, X, Check, Flame } from "lucide-react-native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { xpForHabit } from "@/features/gamification/xp";
import { taskCoins } from "@/features/gamification/coins";
import { comboMultiplier } from "@/features/gamification/combo";
import type { Trackable } from "../api";
import type { TrackableStatus } from "@/features/completions/derived";

const DIFF_TINT: Record<Trackable["difficulty"], string> = {
  easy: theme.color.jade,
  medium: theme.color.violet,
  hard: theme.color.fire,
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function scheduleLabel(t: Trackable): string | null {
  if (t.kind !== "habit") return null;
  if (t.period === "week") return `Weekly ×${t.quota}`;
  if (t.period === "month") return t.quota > 1 ? `Monthly ×${t.quota}` : "Monthly";
  if (!t.weekdays || t.weekdays.length === 0) return "Daily";
  return t.weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(", ");
}

/** XP/coin payout for completing right now — combo applies to the streak *after* this completion. */
function payoutLabel(t: Trackable, projectedStreak: number): string {
  if (t.kind === "task") return `+${taskCoins(t.difficulty)} coins`;
  return `+${xpForHabit(t.difficulty, projectedStreak)} XP · +${t.coinValue} coins`;
}

export function TrackableCard({
  trackable,
  status,
  onEdit,
  onArchive,
  onToggleComplete,
  completing,
}: {
  trackable: Trackable;
  status: TrackableStatus;
  onEdit: () => void;
  onArchive: () => void;
  onToggleComplete: () => void;
  completing?: boolean;
}) {
  const tint = DIFF_TINT[trackable.difficulty];
  const schedule = scheduleLabel(trackable);
  const projectedStreak = status.isDoneToday ? status.streak : status.streak + 1;
  const projectedCombo = comboMultiplier(projectedStreak);

  return (
    <View style={[styles.card, status.isDoneToday && styles.cardDone]}>
      <View style={[styles.emojiBox, { backgroundColor: tint }]}>
        <Text style={styles.emoji}>{trackable.emoji}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
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
          {schedule && (
            <View style={styles.scheduleBadge}>
              <Text style={styles.scheduleText}>{schedule}</Text>
            </View>
          )}
          {status.streak > 0 && (
            <View style={styles.streakBadge}>
              <Flame size={12} strokeWidth={3} color={theme.color.fire} />
              <Text style={styles.streakText}>{status.streak}</Text>
            </View>
          )}
          {status.periodProgress && (
            <View style={styles.progressBadge}>
              <Text style={styles.progressText}>
                {status.periodProgress.completed}/{status.periodProgress.quota}{" "}
                {trackable.period === "week" ? "this wk" : "this mo"}
              </Text>
            </View>
          )}
          {projectedCombo > 1 && <Text style={styles.combo}>combo ×{projectedCombo}</Text>}
          <Text style={styles.payout}>{payoutLabel(trackable, projectedStreak)}</Text>
        </View>
      </View>
      <Pressable
        style={[styles.checkBtn, status.isDoneToday && styles.checkBtnDone]}
        onPress={onToggleComplete}
        disabled={completing}
        aria-label={status.isDoneToday ? `Undo ${trackable.name}` : `Complete ${trackable.name}`}
      >
        <Check size={20} strokeWidth={4} color={status.isDoneToday ? "#fff" : theme.color.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 12,
  },
  cardDone: { opacity: 0.55 },
  emojiBox: {
    width: 46,
    height: 46,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 22 },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontWeight: "700", fontSize: 16, color: theme.color.ink, flexShrink: 1, fontFamily: fonts.display600 },
  actions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 6, flexWrap: "wrap" },
  pill: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  pillText: { fontSize: 11, fontWeight: "700", color: "#fff", textTransform: "capitalize" },
  scheduleBadge: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: "#fff",
  },
  scheduleText: { fontSize: 11, fontWeight: "700", color: theme.color.ink },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: "#fff",
  },
  streakText: { fontSize: 11, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.mono700 },
  progressBadge: {
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: theme.color.yellow,
  },
  progressText: { fontSize: 11, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.mono700 },
  combo: { fontSize: 11, fontWeight: "700", color: theme.color.violet },
  payout: { marginLeft: "auto", fontSize: 12, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.mono700 },
  checkBtn: {
    width: 44,
    height: 44,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkBtnDone: { backgroundColor: theme.color.jade },
});
