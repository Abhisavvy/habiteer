import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Modal, ModalIcon, ModalTitle, ModalActions, ModalButton } from "@/components/Modal";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { today } from "@/features/trackables/today";
import { addDays } from "@/features/gamification/dates";
import { GOAL_STAKE_MIN, GOAL_TARGET_MIN, GOAL_CHECKPOINT_COUNT } from "@/features/gamification/constants";
import { maxAchievableInWindow, checkpointThreshold, checkpointPayoutTotal, completionBonus } from "../derived";
import type { Trackable } from "@/features/trackables/api";
import type { GoalFormValues } from "../api";

const WEEK_PRESETS = [2, 4, 6, 8];
const STAKE_STEP = 10;

/**
 * Pledge creation — built on the shared `Modal.tsx` shell (so it gets the real
 * enter/exit animation for free) rather than a bespoke full panel like
 * `TrackablePanel`, since this form is small: two steppers and a duration
 * segmented control, matching that panel's exact preset-row/stepper-row
 * convention. `startsOn` is always today, not user-editable — no back-dating a
 * commitment you've already partly fulfilled.
 *
 * The checkpoint ladder is shown BEFORE staking, deliberately. Asking someone
 * to put coins at risk without showing exactly how those coins come back is how
 * a commitment mechanic reads as a punishment mechanic.
 */
export function GoalPanel({
  trackable,
  balance,
  visible,
  submitting,
  onCancel,
  onSubmit,
}: {
  trackable: Trackable;
  /** Spendable coins. Only keeps the stepper honest — the server re-checks the
   * balance under a row lock, which is the actual gate. */
  balance: number;
  visible: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: GoalFormValues) => void;
}) {
  const [targetCount, setTargetCount] = useState(Math.max(GOAL_TARGET_MIN, 12));
  const [weeks, setWeeks] = useState(4);
  const [stakedCoins, setStakedCoins] = useState(() =>
    Math.max(GOAL_STAKE_MIN, Math.min(30, Math.floor(balance / STAKE_STEP) * STAKE_STEP))
  );

  const startsOn = today();
  const endsOn = addDays(startsOn, weeks * 7 - 1);
  const maxAchievable = maxAchievableInWindow(trackable, startsOn, endsOn);
  const overAmbitious = targetCount > maxAchievable;
  const canAfford = stakedCoins <= balance;
  const bonus = completionBonus(stakedCoins);

  // What each checkpoint costs in completions and pays in coins. The math is
  // cumulative, so the per-row figure is the delta — which is what a single
  // Bank tap actually credits.
  const ladder = Array.from({ length: GOAL_CHECKPOINT_COUNT }, (_, idx) => {
    const i = idx + 1;
    return {
      i,
      at: checkpointThreshold(targetCount, i),
      pays: checkpointPayoutTotal(stakedCoins, i) - checkpointPayoutTotal(stakedCoins, i - 1),
    };
  });

  const submit = () => onSubmit({ trackableId: trackable.id, targetCount, startsOn, endsOn, stakedCoins });

  return (
    <Modal visible={visible} onRequestClose={onCancel}>
      <ModalIcon emoji="🤝" />
      <ModalTitle>Pledge on {trackable.name}</ModalTitle>

      <View style={styles.row}>
        <Text style={styles.label}>Target</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => setTargetCount((v) => Math.max(GOAL_TARGET_MIN, v - 1))}
          >
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
            <Pressable
              key={w}
              style={[styles.segment, weeks === w && styles.segmentSelected]}
              onPress={() => setWeeks(w)}
            >
              <Text style={[styles.segmentText, weeks === w && styles.segmentTextSelected]}>{w}wk</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Stake · you have 🪙 {balance}</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => setStakedCoins((v) => Math.max(GOAL_STAKE_MIN, v - STAKE_STEP))}
          >
            <Text style={styles.stepperBtnText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>🪙 {stakedCoins}</Text>
          <Pressable style={styles.stepperBtn} onPress={() => setStakedCoins((v) => v + STAKE_STEP)}>
            <Text style={styles.stepperBtnText}>＋</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.ladder}>
        <Text style={styles.ladderTitle}>You get it back as you go</Text>
        {ladder.map((c) => (
          <View key={c.i} style={styles.ladderRow}>
            <Text style={styles.ladderAt}>
              {c.at}× done{c.i === GOAL_CHECKPOINT_COUNT ? " — all of it" : ""}
            </Text>
            <Text style={styles.ladderPays}>+🪙 {c.pays}</Text>
          </View>
        ))}
        <View style={styles.ladderRow}>
          <Text style={styles.ladderBonusLabel}>Finish it · bonus</Text>
          <Text style={styles.ladderBonus}>+🪙 {bonus}</Text>
        </View>
      </View>

      {!canAfford && <Text style={styles.error}>You only have 🪙 {balance} to stake.</Text>}

      {overAmbitious && (
        <Text style={styles.warning}>
          "{trackable.name}" can realistically hit about {maxAchievable}× in {weeks} weeks on its current schedule — with
          coins on the line, that's worth a second look.
        </Text>
      )}

      <ModalActions>
        <ModalButton label="Cancel" variant="cancel" onPress={onCancel} />
        <ModalButton
          label={submitting ? "Staking…" : `Stake 🪙 ${stakedCoins}`}
          variant="jade"
          onPress={submit}
          disabled={!canAfford || submitting}
        />
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
  stepperValue: {
    minWidth: 72,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
    color: theme.color.ink,
    fontFamily: fonts.mono700,
    paddingHorizontal: 6,
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
  segmentText: {
    fontWeight: "700",
    fontSize: 13,
    color: "rgba(26,21,35,0.55)",
    fontFamily: fonts.display700,
    textAlign: "center",
  },
  segmentTextSelected: { color: "#fff" },
  ladder: {
    width: "100%",
    marginTop: 13,
    padding: 11,
    gap: 5,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    borderRadius: 12,
    backgroundColor: theme.color.paper,
  },
  ladderTitle: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "rgba(26,21,35,0.55)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: fonts.mono700,
    marginBottom: 1,
  },
  ladderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ladderAt: { fontSize: 12, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.mono700 },
  ladderPays: { fontSize: 12, fontWeight: "700", color: theme.color.success, fontFamily: fonts.mono700 },
  ladderBonusLabel: { fontSize: 12, fontWeight: "700", color: theme.color.violet, fontFamily: fonts.mono700 },
  ladderBonus: { fontSize: 12, fontWeight: "700", color: theme.color.violet, fontFamily: fonts.mono700 },
  error: {
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.color.fire,
    fontFamily: fonts.display600,
    marginTop: 10,
    textAlign: "center",
  },
  warning: {
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.color.ember,
    fontFamily: fonts.display600,
    marginTop: 10,
    textAlign: "center",
  },
});
