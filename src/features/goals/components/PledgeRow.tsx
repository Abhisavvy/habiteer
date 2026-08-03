import { View, Text, Pressable, StyleSheet } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { pledgeView, type GoalStatus } from "../derived";

/**
 * A habit's pledge line on the Stats screen: where it stands, what a Bank tap
 * would pay, and what's still riding on it.
 *
 * The at-risk figure is shown on purpose. A commitment device that hides the
 * downside isn't a commitment device — and because settlement banks earned
 * checkpoints before forfeiting, the number shown here is genuinely only the
 * part that was never earned.
 */
export function PledgeRow({
  status,
  busy,
  onPledge,
  onBank,
  onSettle,
  onAbandon,
}: {
  /** `null` when this habit has no pledge on record. */
  status: GoalStatus | null;
  busy?: boolean;
  onPledge: () => void;
  onBank: () => void;
  onSettle: () => void;
  onAbandon: () => void;
}) {
  if (!status) {
    return (
      <View style={styles.row}>
        <Pressable onPress={onPledge} disabled={busy}>
          <Text style={styles.link}>🤝 Make a pledge</Text>
        </Pressable>
      </View>
    );
  }

  const { goal, progress, onPace, state } = status;
  const v = pledgeView(goal, progress);

  // Terminal pledges are settlement records, kept as history — there's nothing
  // left to act on, so they read as a result and offer a fresh start.
  if (goal.state === "kept") {
    return (
      <View style={styles.row}>
        <Text style={styles.kept}>
          🏆 Pledge kept · {progress}/{goal.targetCount}
        </Text>
        <Pressable onPress={onPledge} disabled={busy}>
          <Text style={styles.link}>Pledge again</Text>
        </Pressable>
      </View>
    );
  }
  if (goal.state === "forfeited") {
    return (
      <View style={styles.row}>
        <Text style={styles.forfeited}>
          Pledge ended · {progress}/{goal.targetCount}
        </Text>
        <Pressable onPress={onPledge} disabled={busy}>
          <Text style={styles.link}>Pledge again</Text>
        </Pressable>
      </View>
    );
  }

  // Still 'active' in the DB but the window has closed: settlement is lazy, so
  // viewing it is what triggers the payout. Offered as an explicit tap rather
  // than fired on render — a silent coin movement on screen-open is the kind of
  // thing that makes an economy feel arbitrary.
  const windowClosed = state === "missed";

  return (
    <View style={styles.stack}>
      <View style={styles.ladderDots}>
        {v.thresholds.map((th, i) => {
          const done = i < v.earnedCheckpoints;
          const banked = i < goal.checkpointsBanked;
          return (
            <View key={th} style={[styles.dot, done && styles.dotEarned, banked && styles.dotBanked]}>
              <Text style={[styles.dotText, done && styles.dotTextDone]}>{th}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.row}>
        <Text style={styles.progress} numberOfLines={1}>
          🤝 {progress}/{goal.targetCount} ·{" "}
          {windowClosed ? "window closed" : state === "upcoming" ? "starts soon" : onPace ? "on pace" : "behind pace"}
          {v.atRisk > 0 && !windowClosed ? ` · 🪙 ${v.atRisk} at risk` : ""}
        </Text>
      </View>

      <View style={styles.actions}>
        {windowClosed ? (
          <HardShadow style={styles.settleBtn} onPress={onSettle} disabled={busy} haptic="medium">
            <Text style={styles.settleText}>
              {v.pendingPayout > 0 ? `Collect 🪙 ${v.pendingPayout}` : "Close it out"}
            </Text>
          </HardShadow>
        ) : v.bankable > 0 ? (
          <HardShadow style={styles.bankBtn} onPress={onBank} disabled={busy} haptic="medium">
            <Text style={styles.bankText}>Bank 🪙 {v.pendingPayout}</Text>
          </HardShadow>
        ) : (
          <Text style={styles.nextUp}>
            Next payout at {v.thresholds[Math.min(v.earnedCheckpoints, v.thresholds.length - 1)]}×
          </Text>
        )}
        {!windowClosed && (
          <Pressable onPress={onAbandon} disabled={busy}>
            <Text style={styles.giveUp}>Give up</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 6, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  link: {
    fontSize: 10.5,
    fontWeight: "700",
    color: theme.color.violet,
    fontFamily: fonts.mono700,
    textDecorationLine: "underline",
  },
  progress: { flex: 1, fontSize: 10.5, fontWeight: "700", color: theme.color.violet, fontFamily: fonts.mono700 },
  kept: { flex: 1, fontSize: 10.5, fontWeight: "700", color: theme.color.success, fontFamily: fonts.mono700 },
  forfeited: { flex: 1, fontSize: 10.5, fontWeight: "700", color: "rgba(26,21,35,0.45)", fontFamily: fonts.mono700 },
  ladderDots: { flexDirection: "row", gap: 6 },
  dot: {
    minWidth: 26,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "rgba(26,21,35,0.25)",
    backgroundColor: theme.color.paper,
    alignItems: "center",
  },
  dotEarned: { borderColor: theme.color.ink, backgroundColor: theme.color.gold },
  dotBanked: { backgroundColor: theme.color.success },
  dotText: { fontSize: 9.5, fontWeight: "700", color: "rgba(26,21,35,0.45)", fontFamily: fonts.mono700 },
  dotTextDone: { color: theme.color.ink },
  bankBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.success,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  bankText: { fontSize: 11.5, fontWeight: "700", color: "#fff", fontFamily: fonts.display700 },
  settleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.gold,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  settleText: { fontSize: 11.5, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.display700 },
  nextUp: { fontSize: 10, fontWeight: "700", color: "rgba(26,21,35,0.45)", fontFamily: fonts.mono700 },
  giveUp: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.color.ember,
    fontFamily: fonts.mono700,
    textDecorationLine: "underline",
  },
});
