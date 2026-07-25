import { useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Animated, StyleSheet, ScrollView } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { defaultCoinValue } from "@/features/gamification/coins";
import type { Difficulty } from "@/features/gamification/constants";
import { DIFF_TINT, DIFF_LIGHT_TINT } from "../constants";
import { today } from "../today";
import type { Trackable } from "../api";
import type { TrackableFormValues } from "../schemas";
import { getReduceMotionCached } from "@/hooks/useReduceMotion";
import { feedbackMedium, feedbackWarning } from "@/features/feedback/feedback";

/** A short back-and-forth shake — the field-error feedback for an invalid submit. */
function shake(anim: Animated.Value): void {
  if (getReduceMotionCached() !== false) return;
  Animated.sequence(
    [-10, 8, -6, 4, 0].map((toValue) => Animated.timing(anim, { toValue, duration: 55, useNativeDriver: true }))
  ).start();
}

/** Shift an ISO date (YYYY-MM-DD) by whole days, UTC-anchored to match today(). */
function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDue(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Nudge an "HH:MM" time by whole minutes, wrapping around midnight. */
function shiftTime(hhmm: string, deltaMin: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + deltaMin + 1440) % 1440;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/** "18:30" → "6:30 PM" for display. */
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${ap}`;
}

const REMINDER_PRESETS: { label: string; value: string | null }[] = [
  { label: "Off", value: null },
  { label: "8AM", value: "08:00" },
  { label: "12PM", value: "12:00" },
  { label: "6PM", value: "18:00" },
  { label: "9PM", value: "21:00" },
];

const EMOJI_CHOICES = ["🏃", "💧", "📖", "🧘", "🥗", "💪", "😴"];
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "EASY" },
  { value: "medium", label: "MED" },
  { value: "hard", label: "HARD" },
];
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
  const [coinValue, setCoinValue] = useState(initial?.coinValue ?? defaultCoinValue("medium"));
  const [goalType, setGoalType] = useState<"build" | "reduce">(initial?.goalType ?? "build");
  const [dueOn, setDueOn] = useState<string | null>(initial?.dueOn ?? null);
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
  const [reminderTime, setReminderTime] = useState<string | null>(initial?.reminderTime ?? null);

  // Reminders make sense for any habit and for a dated task; an "anytime" task
  // has no time to anchor a notification to, so the picker is hidden there.
  const showReminder = kind === "habit" || dueOn !== null;

  const selectDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    setCoinValue(defaultCoinValue(d));
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

  const shakeAnim = useRef(new Animated.Value(0)).current;

  const submit = () => {
    if (!canSubmit) {
      feedbackWarning();
      shake(shakeAnim);
      return;
    }
    feedbackMedium();
    onSubmit({
      kind,
      name: name.trim(),
      emoji,
      difficulty,
      coinValue,
      goalType: kind === "habit" ? goalType : "build",
      weekdays: kind === "habit" && scheduleMode === "specific" ? weekdays : null,
      period: kind === "task" ? null : scheduleMode === "weekly" ? "week" : scheduleMode === "monthly" ? "month" : "day",
      quota: kind === "habit" && isRecurrence ? Number(quota) || 1 : 1,
      dueOn: kind === "task" ? dueOn : null,
      reminderTime: showReminder ? reminderTime : null,
    });
  };

  const title = mode === "edit" ? (kind === "habit" ? "Edit habit" : "Edit task") : kind === "habit" ? "New habit" : "New task";

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Pressable style={styles.closeBtn} onPress={onCancel} aria-label="Close">
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <HardShadow style={styles.panel} animatedStyle={{ transform: [{ translateX: shakeAnim }] }}>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Name your habit or task…"
            placeholderTextColor="rgba(26,21,35,0.4)"
            value={name}
            onChangeText={setName}
            maxLength={28}
          />
        </View>

        {mode === "add" && (
          <View style={styles.segmented}>
            {(["habit", "task"] as const).map((k) => (
              <Pressable
                key={k}
                style={[styles.segment, kind === k && styles.segmentSelected]}
                onPress={() => setKind(k)}
              >
                <Text style={[styles.segmentText, kind === k && styles.segmentTextSelected]}>
                  {k === "habit" ? "Habit" : "Task"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.emojiRow}>
              {EMOJI_CHOICES.map((e) => (
                <HardShadow
                  key={e}
                  style={[
                    styles.emojiBtn,
                    emoji === e && [styles.emojiBtnSelected, { backgroundColor: DIFF_LIGHT_TINT[difficulty] }],
                  ]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </HardShadow>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.diffRow}>
            {DIFFICULTIES.map((d) => (
              <Pressable
                key={d.value}
                style={[
                  styles.diffBtn,
                  difficulty === d.value && { backgroundColor: DIFF_TINT[d.value], borderWidth: theme.border },
                ]}
                onPress={() => selectDifficulty(d.value)}
              >
                <Text style={[styles.diffText, difficulty === d.value && styles.diffTextSelected]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {kind === "task" && (
          <View style={styles.row}>
            <Text style={styles.label}>When</Text>
            <View style={styles.segmented}>
              {(
                [
                  { id: "anytime", label: "Anytime", value: null },
                  { id: "today", label: "Today", value: today() },
                  { id: "tomorrow", label: "Tomorrow", value: shiftISO(today(), 1) },
                  { id: "week", label: "In a week", value: shiftISO(today(), 7) },
                ] as const
              ).map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.segment, dueOn === p.value && styles.segmentSelected]}
                  onPress={() => setDueOn(p.value)}
                >
                  <Text style={[styles.segmentText, dueOn === p.value && styles.segmentTextSelected]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            {dueOn && (
              <View style={styles.dueRow}>
                <Pressable
                  style={styles.stepperBtn}
                  onPress={() => setDueOn((d) => shiftISO(d ?? today(), -1))}
                  disabled={dueOn <= today()}
                >
                  <Text style={[styles.stepperBtnText, dueOn <= today() && styles.stepperBtnTextDisabled]}>−</Text>
                </Pressable>
                <Text style={styles.dueDateText}>{formatDue(dueOn)}</Text>
                <Pressable style={styles.stepperBtn} onPress={() => setDueOn((d) => shiftISO(d ?? today(), 1))}>
                  <Text style={styles.stepperBtnText}>＋</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {kind === "habit" && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Goal</Text>
              <View style={styles.segmented}>
                {(["build", "reduce"] as const).map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.segment, goalType === g && styles.segmentSelected]}
                    onPress={() => setGoalType(g)}
                  >
                    <Text style={[styles.segmentText, goalType === g && styles.segmentTextSelected]}>
                      {g === "build" ? "Build a habit" : "Break a habit"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Coins</Text>
              <View style={styles.stepper}>
                <Pressable style={styles.stepperBtn} onPress={() => setCoinValue((v) => Math.max(1, v - 1))}>
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{coinValue}</Text>
                <Pressable style={styles.stepperBtn} onPress={() => setCoinValue((v) => v + 1)}>
                  <Text style={styles.stepperBtnText}>＋</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Schedule</Text>
              <View style={styles.segmented}>
                {(["daily", "specific", "weekly", "monthly"] as const).map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.segment, scheduleMode === s && styles.segmentSelected]}
                    onPress={() => selectScheduleMode(s)}
                  >
                    <Text style={[styles.segmentText, scheduleMode === s && styles.segmentTextSelected]}>
                      {s === "daily" ? "Every day" : s === "specific" ? "Specific days" : s === "weekly" ? "Weekly" : "Monthly"}
                    </Text>
                  </Pressable>
                ))}
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
                <View style={styles.quotaRow}>
                  <Text style={styles.label}>{scheduleMode === "weekly" ? "Times per week" : "Times per month"}</Text>
                  <TextInput style={styles.quotaInput} value={quota} onChangeText={setQuota} keyboardType="number-pad" />
                  {!hasRecurrenceLevel && (
                    <Text style={styles.hint}>
                      Reach level {RECURRENCE_LEVEL} for weekly/monthly habits — you're level {level}.
                    </Text>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {showReminder && (
          <View style={styles.row}>
            <Text style={styles.label}>Remind me</Text>
            <View style={styles.segmented}>
              {REMINDER_PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  style={[styles.segment, reminderTime === p.value && styles.segmentSelected]}
                  onPress={() => setReminderTime(p.value)}
                >
                  <Text style={[styles.segmentText, reminderTime === p.value && styles.segmentTextSelected]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
            {reminderTime && (
              <View style={styles.dueRow}>
                <Pressable style={styles.stepperBtn} onPress={() => setReminderTime((t) => shiftTime(t ?? "09:00", -15))}>
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <Text style={styles.dueDateText}>{formatTime(reminderTime)}</Text>
                <Pressable style={styles.stepperBtn} onPress={() => setReminderTime((t) => shiftTime(t ?? "09:00", 15))}>
                  <Text style={styles.stepperBtnText}>＋</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </HardShadow>

      <View style={styles.actionsRow}>
        <HardShadow style={styles.ghostBtn} onPress={onCancel}>
          <Text style={styles.ghostText}>Cancel</Text>
        </HardShadow>
        <HardShadow
          style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
          disabled={submitting}
          onPress={submit}
          haptic="none"
        >
          <Text style={styles.primaryText}>{mode === "add" ? `Save ${kind}` : "Save"}</Text>
        </HardShadow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 24, color: theme.color.ink, fontFamily: fonts.heading, letterSpacing: 0.5, textTransform: "uppercase" },
  closeBtn: {
    width: 34,
    height: 34,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    backgroundColor: "#fff",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontWeight: "700", fontSize: 16, color: theme.color.ink, fontFamily: fonts.display700 },
  panel: {
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 15,
    gap: 15,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  row: { gap: 7 },
  label: { fontSize: 10, fontWeight: "700", color: "rgba(26,21,35,0.6)", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: fonts.mono700 },
  input: {
    fontWeight: "600",
    fontSize: 15,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    borderRadius: 10,
    padding: 11,
    backgroundColor: theme.color.paper,
    color: theme.color.ink,
    fontFamily: fonts.display600,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: theme.color.paper,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    borderRadius: 11,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 8 },
  segmentSelected: { backgroundColor: theme.color.violet },
  segmentText: { fontWeight: "700", fontSize: 13, color: "rgba(26,21,35,0.55)", fontFamily: fonts.display700, textAlign: "center" },
  segmentTextSelected: { color: "#fff" },
  emojiRow: { flexDirection: "row", gap: 7 },
  emojiBtn: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: "rgba(26,21,35,0.25)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBtnSelected: {
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  emojiText: { fontSize: 20 },
  diffRow: { flexDirection: "row", gap: 8 },
  diffBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: "rgba(26,21,35,0.25)",
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  diffText: { fontWeight: "700", fontSize: 12, color: "rgba(26,21,35,0.55)", fontFamily: fonts.mono700 },
  diffTextSelected: { color: theme.color.ink },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    borderRadius: 10,
    backgroundColor: theme.color.paper,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  stepperBtn: { width: 36, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  stepperBtnText: { fontWeight: "700", fontSize: 18, color: theme.color.ink, fontFamily: fonts.display700 },
  stepperBtnTextDisabled: { color: "rgba(26,21,35,0.25)" },
  stepperValue: { width: 50, textAlign: "center", fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.mono700 },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    borderRadius: 10,
    backgroundColor: theme.color.paper,
    overflow: "hidden",
    marginTop: 8,
  },
  dueDateText: {
    minWidth: 130,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 14,
    color: theme.color.ink,
    fontFamily: fonts.mono700,
    paddingHorizontal: 8,
  },
  weekdayRow: { flexDirection: "row", gap: 6, justifyContent: "space-between" },
  weekdayBtn: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: "rgba(26,21,35,0.25)",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayBtnSelected: { borderWidth: theme.border, borderColor: theme.color.ink, backgroundColor: theme.color.violet },
  weekdayText: { fontWeight: "700", fontSize: 12, color: "rgba(26,21,35,0.5)", fontFamily: fonts.mono700 },
  weekdayTextSelected: { color: "#fff" },
  quotaRow: { gap: 7, marginTop: 4 },
  quotaInput: {
    fontWeight: "700",
    fontSize: 15,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    padding: 8,
    backgroundColor: "#fff",
    color: theme.color.ink,
    width: 90,
    fontFamily: fonts.mono700,
  },
  hint: { fontSize: 12, fontWeight: "600", color: theme.color.fire },
  actionsRow: { flexDirection: "row", gap: 12, marginTop: 2 },
  ghostBtn: {
    flex: 1,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: "#fff",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  ghostText: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  primaryBtn: {
    flex: 1.4,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.hero,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryText: { fontWeight: "700", fontSize: 15, color: "#fff", fontFamily: fonts.display700 },
});
