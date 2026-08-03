import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Modal, ModalIcon, ModalTitle, ModalActions, ModalButton } from "@/components/Modal";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { today } from "@/features/trackables/today";
import { addDays } from "@/features/gamification/dates";
import { maxAchievableInWindow } from "../derived";
import type { Trackable } from "@/features/trackables/api";
import type { GoalFormValues } from "../api";

const WEEK_PRESETS = [2, 4, 6, 8];

/**
 * Goal creation — built on the shared `Modal.tsx` shell (gets the real
 * enter/exit animation for free) rather than a bespoke full panel like
 * `TrackablePanel`, since this form is small: a target-count stepper + a
 * duration segmented control, matching that panel's exact preset-row/
 * stepper-row convention. `startsOn` is always today, not user-editable in
 * v1 — no back-dating, no scheduling a goal for later.
 */
export function GoalPanel({
  trackable,
  visible,
  submitting,
  onCancel,
  onSubmit,
}: {
  trackable: Trackable;
  visible: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: GoalFormValues) => void;
}) {
  const [targetCount, setTargetCount] = useState(10);
  const [weeks, setWeeks] = useState(4);

  const startsOn = today();
  const endsOn = addDays(startsOn, weeks * 7 - 1);
  const maxAchievable = maxAchievableInWindow(trackable, startsOn, endsOn);
  const overAmbitious = targetCount > maxAchievable;

  const submit = () => onSubmit({ trackableId: trackable.id, targetCount, startsOn, endsOn });

  return (
    <Modal visible={visible} onRequestClose={onCancel}>
      <ModalIcon emoji="🎯" />
      <ModalTitle>Set a goal for {trackable.name}</ModalTitle>

      <View style={styles.row}>
        <Text style={styles.label}>Target</Text>
        <View style={styles.stepper}>
          <Pressable style={styles.stepperBtn} onPress={() => setTargetCount((v) => Math.max(1, v - 1))}>
            <Text style={styles.stepperBtnText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{targetCount}×</Text>
          <Pressable style={styles.stepperBtn} onPress={() => setTargetCount((v) => v + 1)}>
            <Text style={styles.stepperBtnText}>＋</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Over</Text>
        <View style={styles.segmented}>
          {WEEK_PRESETS.map((w) => (
            <Pressable key={w} style={[styles.segment, weeks === w && styles.segmentSelected]} onPress={() => setWeeks(w)}>
              <Text style={[styles.segmentText, weeks === w && styles.segmentTextSelected]}>{w}wk</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {overAmbitious && (
        <Text style={styles.warning}>
          "{trackable.name}" can realistically hit about {maxAchievable}× in {weeks} weeks on its current schedule — this
          target may be a stretch.
        </Text>
      )}

      <ModalActions>
        <ModalButton label="Cancel" variant="cancel" onPress={onCancel} />
        <ModalButton label={submitting ? "Saving…" : "Set goal"} variant="jade" onPress={submit} />
      </ModalActions>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", gap: 7, marginTop: 10 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(26,21,35,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.mono700,
  },
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
  stepperValue: { width: 56, textAlign: "center", fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.mono700 },
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
  warning: { fontSize: 11.5, lineHeight: 16, color: theme.color.ember, fontFamily: fonts.display600, marginTop: 10, textAlign: "center" },
});
