import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { theme } from "@/constants/theme";
import { defaultCoinValue } from "@/features/gamification/coins";
import type { Difficulty } from "@/features/gamification/constants";
import type { Trackable } from "../api";
import type { TrackableFormValues } from "../schemas";

const EMOJI_CHOICES = ["🔥", "📚", "🏋️", "🧠", "🥗", "🎨", "💻", "🌱", "🎯", "☕"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const DIFF_TINT: Record<Difficulty, string> = {
  easy: theme.color.jade,
  medium: theme.color.violet,
  hard: theme.color.fire,
};
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// PLAN.md §9 — mirrors the "own trackables" WITH CHECK level-5 gate in
// rls.sql. The server is authoritative; this only swaps a raw RLS error for
// a friendly message before the request goes out.
const RECURRENCE_LEVEL = 5;

type ScheduleMode = "daily" | "specific" | "weekly" | "monthly";

export function TrackablePanel({
  mode,
  initial,
  level,
  onSubmit,
  onCancel,
  submitting,
}: {
  mode: "add" | "edit";
  initial?: Trackable;
  level: number;
  onSubmit: (values: TrackableFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const [kind, setKind] = useState<"habit" | "task">(initial?.kind ?? "habit");
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJI_CHOICES[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "medium");
  const [coinValue, setCoinValue] = useState(String(initial?.coinValue ?? defaultCoinValue("medium")));
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>(
    initial?.period === "week"
      ? "weekly"
      : initial?.period === "month"
        ? "monthly"
        : initial?.weekdays && initial.weekdays.length > 0
          ? "specific"
          : "daily"
  );
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? []);
  const [quota, setQuota] = useState(String(initial?.quota && initial.quota > 1 ? initial.quota : 3));

  const selectDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    setCoinValue(String(defaultCoinValue(d)));
  };

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const selectScheduleMode = (next: ScheduleMode) => {
    if (next === "weekly" && scheduleMode !== "weekly") setQuota("3");
    if (next === "monthly" && scheduleMode !== "monthly") setQuota("1");
    setScheduleMode(next);
  };

  const isRecurrence = scheduleMode === "weekly" || scheduleMode === "monthly";
  const hasRecurrenceLevel = level >= RECURRENCE_LEVEL;

  const canSubmit =
    name.trim().length > 0 &&
    (kind === "task" ||
      scheduleMode === "daily" ||
      (scheduleMode === "specific" && weekdays.length > 0) ||
      (isRecurrence && Number(quota) > 0 && hasRecurrenceLevel));

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      kind,
      name: name.trim(),
      emoji,
      difficulty,
      coinValue: Number(coinValue) || defaultCoinValue(difficulty),
      weekdays: kind === "habit" && scheduleMode === "specific" ? weekdays : null,
      period: kind === "task" ? null : scheduleMode === "weekly" ? "week" : scheduleMode === "monthly" ? "month" : "day",
      quota: kind === "habit" && isRecurrence ? Number(quota) || 1 : 1,
    });
  };

  return (
    <View style={styles.panel}>
      <TextInput
        style={styles.input}
        placeholder="Name your habit or task…"
        value={name}
        onChangeText={setName}
        maxLength={28}
      />

      {mode === "add" && (
        <View style={styles.row}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.buttonRow}>
            {(["habit", "task"] as const).map((k) => (
              <Pressable
                key={k}
                style={[styles.choiceBtn, kind === k && styles.choiceBtnSelected]}
                onPress={() => setKind(k)}
              >
                <Text style={[styles.choiceText, kind === k && styles.choiceTextSelected]}>
                  {k === "habit" ? "Habit" : "Task"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>Icon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.emojiRow}>
            {EMOJI_CHOICES.map((e) => (
              <Pressable
                key={e}
                style={[styles.emojiBtn, emoji === e && styles.emojiBtnSelected]}
                onPress={() => setEmoji(e)}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Effort</Text>
        <View style={styles.buttonRow}>
          {DIFFICULTIES.map((d) => (
            <Pressable
              key={d}
              style={[styles.diffBtn, difficulty === d && { backgroundColor: DIFF_TINT[d] }]}
              onPress={() => selectDifficulty(d)}
            >
              <Text style={[styles.diffText, difficulty === d && styles.diffTextSelected]}>{d}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {kind === "habit" && (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>Coins</Text>
            <TextInput
              style={styles.coinInput}
              value={coinValue}
              onChangeText={setCoinValue}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Schedule</Text>
            <View style={styles.scheduleRow}>
              {(["daily", "specific", "weekly", "monthly"] as const).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.scheduleBtn, scheduleMode === s && styles.choiceBtnSelected]}
                  onPress={() => selectScheduleMode(s)}
                >
                  <Text style={[styles.choiceText, scheduleMode === s && styles.choiceTextSelected]}>
                    {s === "daily" ? "Every day" : s === "specific" ? "Specific days" : s === "weekly" ? "Weekly" : "Monthly"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {scheduleMode === "specific" && (
            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((label, i) => (
                <Pressable
                  key={label}
                  style={[styles.weekdayBtn, weekdays.includes(i) && styles.weekdayBtnSelected]}
                  onPress={() => toggleWeekday(i)}
                >
                  <Text style={[styles.weekdayText, weekdays.includes(i) && styles.weekdayTextSelected]}>
                    {label[0]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {isRecurrence && (
            <View style={styles.row}>
              <Text style={styles.label}>{scheduleMode === "weekly" ? "Times per week" : "Times per month"}</Text>
              <TextInput style={styles.coinInput} value={quota} onChangeText={setQuota} keyboardType="number-pad" />
              {!hasRecurrenceLevel && (
                <Text style={styles.hint}>
                  Reach level {RECURRENCE_LEVEL} for weekly/monthly habits — you're level {level}.
                </Text>
              )}
            </View>
          )}
        </>
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.ghostBtn} onPress={onCancel}>
          <Text style={styles.ghostText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
          disabled={!canSubmit || submitting}
          onPress={submit}
        >
          <Text style={styles.primaryText}>{mode === "add" ? "Add it" : "Save"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 14,
    gap: 12,
  },
  input: {
    fontWeight: "600",
    fontSize: 16,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    color: theme.color.ink,
  },
  row: { gap: 7 },
  label: { fontSize: 12, fontWeight: "700", opacity: 0.6, color: theme.color.ink },
  buttonRow: { flexDirection: "row", gap: 8 },
  choiceBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  choiceBtnSelected: { backgroundColor: theme.color.violet },
  choiceText: { fontWeight: "700", fontSize: 13, color: theme.color.ink },
  choiceTextSelected: { color: "#fff" },
  emojiRow: { flexDirection: "row", gap: 7 },
  emojiBtn: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  emojiBtnSelected: { backgroundColor: theme.color.yellow },
  emojiText: { fontSize: 18 },
  diffBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  diffText: { fontWeight: "700", fontSize: 13, color: theme.color.ink, textTransform: "capitalize" },
  diffTextSelected: { color: "#fff" },
  coinInput: {
    fontWeight: "700",
    fontSize: 15,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    padding: 8,
    backgroundColor: "#fff",
    color: theme.color.ink,
    width: 90,
  },
  scheduleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  scheduleBtn: {
    minWidth: "46%",
    flexGrow: 1,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  hint: { fontSize: 12, fontWeight: "600", color: theme.color.fire },
  weekdayRow: { flexDirection: "row", gap: 6 },
  weekdayBtn: {
    flex: 1,
    height: 34,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  weekdayBtnSelected: { backgroundColor: theme.color.jade },
  weekdayText: { fontWeight: "700", fontSize: 12, color: theme.color.ink },
  weekdayTextSelected: { color: "#fff" },
  actionsRow: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  ghostBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, borderWidth: theme.border, borderColor: theme.color.ink, backgroundColor: "#fff" },
  ghostText: { fontWeight: "700", fontSize: 14, color: theme.color.ink },
  primaryBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.violet,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryText: { fontWeight: "700", fontSize: 14, color: "#fff" },
});
