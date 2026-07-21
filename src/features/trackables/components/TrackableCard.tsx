import { View, Text, Pressable, StyleSheet } from "react-native";
import { Pencil, X } from "lucide-react-native";
import { theme } from "@/constants/theme";
import { xpForHabit } from "@/features/gamification/xp";
import { taskCoins } from "@/features/gamification/coins";
import type { Trackable } from "../api";

const DIFF_TINT: Record<Trackable["difficulty"], string> = {
  easy: theme.color.jade,
  medium: theme.color.violet,
  hard: theme.color.fire,
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function scheduleLabel(t: Trackable): string | null {
  if (t.kind !== "habit") return null;
  if (!t.weekdays || t.weekdays.length === 0) return "Daily";
  return t.weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(", ");
}

function payoutLabel(t: Trackable): string {
  if (t.kind === "task") return `+${taskCoins(t.difficulty)} coins`;
  return `+${xpForHabit(t.difficulty, 0)} XP · +${t.coinValue} coins`;
}

export function TrackableCard({
  trackable,
  onEdit,
  onArchive,
}: {
  trackable: Trackable;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const tint = DIFF_TINT[trackable.difficulty];
  const schedule = scheduleLabel(trackable);

  return (
    <View style={styles.card}>
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
          <Text style={styles.payout}>{payoutLabel(trackable)}</Text>
        </View>
      </View>
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
  name: { fontWeight: "700", fontSize: 16, color: theme.color.ink, flexShrink: 1 },
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
  payout: { marginLeft: "auto", fontSize: 12, fontWeight: "700", color: theme.color.ink },
});
