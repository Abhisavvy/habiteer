import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useAddAction } from "@/features/navigation/addAction";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useTrackablesQuery, useCreateTrackable, useUpdateTrackable, useArchiveTrackable } from "@/features/trackables/useTrackables";
import { filterDueToday, today } from "@/features/trackables/today";
import { TrackableCard } from "@/features/trackables/components/TrackableCard";
import { TrackablePanel } from "@/features/trackables/components/TrackablePanel";
import { STARTER_HABITS, presetToFormValues } from "@/features/trackables/presets";
import { DIFF_LIGHT_TINT } from "@/features/trackables/constants";
import type { Trackable } from "@/features/trackables/api";
import {
  useCompletionsQuery,
  useCoinBalanceQuery,
  useFreezeBalanceQuery,
  useCompleteTrackable,
  useUndoCompletion,
} from "@/features/completions/useCompletions";
import { trackableStatus, overallProgress, daysSinceLastActivity } from "@/features/completions/derived";
import { LevelBar } from "@/features/completions/components/LevelBar";
import { useFloatingXp, FloatingXpOverlay } from "@/features/completions/components/FloatingXp";
import { LevelUpOverlay } from "@/features/completions/components/LevelUpOverlay";
import { UndoToast } from "@/features/completions/components/UndoToast";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { Modal } from "@/components/Modal";
import { HardShadow } from "@/components/HardShadow";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { StaggerItem } from "@/components/StaggerItem";
import { Ember, expressionForStreak } from "@/components/Ember";
import { IdleEmber } from "@/components/IdleEmber";
import { Halftone } from "@/components/Halftone";
import { useProfileQuery } from "@/features/profile/useProfile";
import { cardSkinFor } from "@/features/cosmetics/catalog";
import { useReminderTap } from "@/features/navigation/reminderTap";
import { feedbackComplete, feedbackLevelUp } from "@/features/feedback/feedback";
import { useGoalsQuery } from "@/features/goals/useGoals";
import { goalStatus, pledgeView } from "@/features/goals/derived";

const LAPSED_DAYS_THRESHOLD = 3;

type PanelState = { mode: "add" } | { mode: "edit"; trackable: Trackable } | null;

export default function Home() {
  const { data: trackables, isLoading, error, refetch: refetchTrackables } = useTrackablesQuery();
  const { data: completions, refetch: refetchCompletions } = useCompletionsQuery();
  const { data: profile } = useProfileQuery();
  const { data: coinBalance } = useCoinBalanceQuery();
  const { data: freezeBalance } = useFreezeBalanceQuery();
  const { data: goals, refetch: refetchGoals } = useGoalsQuery();
  const createMutation = useCreateTrackable();
  const updateMutation = useUpdateTrackable();
  const archiveMutation = useArchiveTrackable();
  const completeMutation = useCompleteTrackable();
  const undoMutation = useUndoCompletion();
  const [panel, setPanel] = useState<PanelState>(null);
  const [levelUp, setLevelUp] = useState<{ level: number; freezeGained: number } | null>(null);
  const [undoToastFor, setUndoToastFor] = useState<Trackable | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ trackable: Trackable; streak: number } | null>(null);
  const { floats, spawn, remove } = useFloatingXp();
  const lastKnownLevel = useRef<number | null>(null);
  const lastKnownFreeze = useRef<number | null>(null);

  // Opens a habit's edit panel when its reminder notification was tapped
  // (set by useNotificationTapHandler at the app root, cleared here).
  const reminderTapId = useReminderTap((s) => s.trackableId);
  const setReminderTapId = useReminderTap((s) => s.setTrackableId);
  useEffect(() => {
    if (!reminderTapId || !trackables) return;
    const match = trackables.find((t) => t.id === reminderTapId);
    if (match) setPanel({ mode: "edit", trackable: match });
    setReminderTapId(null);
  }, [reminderTapId, trackables]);

  const todayStr = today();
  const dueToday = trackables ? filterDueToday(trackables, todayStr) : [];
  const allCompletions = completions ?? [];
  const progress = overallProgress(allCompletions);

  useEffect(() => {
    if (lastKnownLevel.current === null) lastKnownLevel.current = progress.level;
  }, [progress.level]);

  useEffect(() => {
    if (lastKnownFreeze.current === null && freezeBalance !== undefined) lastKnownFreeze.current = freezeBalance;
  }, [freezeBalance]);

  // Account-wide pledge state for the header line. Sums across every live
  // pledge rather than picking one, since the question a player actually has is
  // "how much of mine is riding on something right now".
  const pledgeSummary = (() => {
    const active = (goals ?? []).filter((g) => g.state === "active");
    if (active.length === 0) return null;
    let atRisk = 0;
    let pending = 0;
    for (const g of active) {
      const v = pledgeView(g, goalStatus(g, allCompletions, todayStr).progress);
      atRisk += v.atRisk;
      pending += v.pendingPayout;
    }
    if (atRisk === 0 && pending === 0) return null;
    return { count: active.length, atRisk, pending, bankable: pending > 0 };
  })();

  // The only refresh path was backgrounding and reopening the app (which the
  // AppState focusManager wiring handles). A deliberate pull is what people
  // reach for when a number looks stale, and its absence reads as the app being
  // out of date rather than the screen simply not having refetched.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchTrackables(), refetchCompletions(), refetchGoals()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchTrackables, refetchCompletions, refetchGoals]);

  const setAddHandler = useAddAction((s) => s.setHandler);
  useFocusEffect(
    useCallback(() => {
      setAddHandler(() => setPanel({ mode: "add" }));
      return () => setAddHandler(null);
    }, [setAddHandler])
  );

  const handleToggleComplete = (t: Trackable, isDoneToday: boolean, anchor: { x: number; y: number }) => {
    // A done card is locked for the day — undo is only via the transient
    // toast below, never by tapping the card again.
    if (isDoneToday) return;
    completeMutation.mutate(t.id, {
      onSuccess: (result) => {
        if (result.xp > 0) spawn(result.xp, anchor);
        const leveledUp = lastKnownLevel.current !== null && result.level.level > lastKnownLevel.current;
        // Level-up gets its own celebratory cue; otherwise the completion cue.
        if (leveledUp) {
          const freezeGained = Math.max(0, result.freezeTokens - (lastKnownFreeze.current ?? result.freezeTokens));
          setLevelUp({ level: result.level.level, freezeGained });
          feedbackLevelUp();
        } else {
          feedbackComplete();
        }
        lastKnownLevel.current = result.level.level;
        lastKnownFreeze.current = result.freezeTokens;
        // Every completion (habit or task) gets the transient undo toast;
        // once it dismisses the completion is locked for the day.
        setUndoToastFor(t);
      },
      onError: (e: Error) => Alert.alert("Couldn't complete that", e.message),
    });
  };

  const dueStatuses = dueToday.map((t) => trackableStatus(t, allCompletions, todayStr));
  const doneCount = dueStatuses.filter((s) => s.isDoneToday).length;
  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  // Ember's mood reflects the best CURRENT streak across today's habits —
  // the same signal the widgets already use (expressionForStreak), just
  // never wired into this in-app header before.
  const topCurrentStreak = Math.max(0, ...dueStatuses.map((s) => s.streak));

  // A distinct, separate signal from the mascot's mood: how long since the
  // account did anything at all, regardless of today's specific due list.
  // `null` (no completions ever) is never "lapsed" — that's just a new user.
  const daysSince = daysSinceLastActivity(allCompletions, todayStr);
  const isLapsed = daysSince !== null && daysSince >= LAPSED_DAYS_THRESHOLD;

  return (
    <View style={styles.root}>
      <Halftone color={theme.color.ink} opacity={0.1} id="today-bg" />
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable style={styles.mascotTile} onPress={() => router.navigate("/profile")} aria-label="Open profile">
            <Ember size={40} expression={expressionForStreak(topCurrentStreak)} />
          </Pressable>
          <Text style={styles.logo}>HABITEER</Text>
          <HardShadow style={styles.coinBadge}>
            <Text style={styles.coinText}>
              🪙 <AnimatedNumber value={coinBalance ?? 0} />
            </Text>
          </HardShadow>
          <View style={styles.freezeBadge}>
            <Text style={styles.freezeText}>❄️ {freezeBalance ?? 0}</Text>
          </View>
        </View>
        <LevelBar level={progress.level} intoLevel={progress.intoLevel} need={progress.need} />
        {isLapsed && <Text style={styles.welcomeBack}>👋 Welcome back — pick up where you left off.</Text>}
        {/* Ember is holding the stake. Shown in the header, next to the coin
            badge, because a commitment you can't see isn't doing its job — the
            whole point of staking is that it's on your mind on an ordinary day,
            not buried on the Stats screen. Only the genuinely-unearned part is
            counted, so it shrinks as checkpoints land. */}
        {pledgeSummary && (
          <Text style={pledgeSummary.bankable ? styles.pledgeReady : styles.pledgeHeld}>
            {pledgeSummary.bankable
              ? `🪙 ${pledgeSummary.pending} ready to bank — open Stats to claim it.`
              : `🤝 Ember is holding 🪙 ${pledgeSummary.atRisk} on ${pledgeSummary.count === 1 ? "your pledge" : `${pledgeSummary.count} pledges`}.`}
          </Text>
        )}
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          {dueToday.length > 0 && (
            <View style={styles.doneCountPill}>
              <Text style={styles.doneCount}>
                {doneCount} / {dueToday.length} done
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.color.violet} colors={[theme.color.violet]} />
        }
      >
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load your habits. Pull to retry.</Text>}

        {undoToastFor && (
          <UndoToast
            name={undoToastFor.name}
            doneVerb={undoToastFor.goalType === "reduce" ? "Resisted" : "Done"}
            onUndo={() => {
              undoMutation.mutate(undoToastFor.id, {
                onError: (e: Error) => Alert.alert("Couldn't undo that", e.message),
              });
            }}
            onDismiss={() => setUndoToastFor(null)}
          />
        )}

        {!isLoading && !error && trackables?.length === 0 && !panel && (
          <View style={styles.empty}>
            <IdleEmber size={72} />
            <Text style={styles.emptyTitle}>Pick one to start</Text>
            <Text style={styles.emptyBody}>Tap any of these, or make your own.</Text>

            {/* One-tap starters. The empty state used to offer only a form
                asking for six decisions before the first completion — the point
                here is that the first action costs a single tap. */}
            <View style={styles.presetGrid}>
              {STARTER_HABITS.map((preset) => (
                <HardShadow
                  key={preset.name}
                  style={[styles.presetChip, { backgroundColor: DIFF_LIGHT_TINT[preset.difficulty] }]}
                  disabled={createMutation.isPending}
                  onPress={() =>
                    createMutation.mutate(presetToFormValues(preset), {
                      onError: (e) => Alert.alert("Couldn't add that", e.message),
                    })
                  }
                >
                  <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                  <Text style={styles.presetName} numberOfLines={2}>
                    {preset.name}
                  </Text>
                </HardShadow>
              ))}
            </View>

            <Pressable onPress={() => setPanel({ mode: "add" })}>
              <Text style={styles.emptyCustomLink}>＋ Make my own habit</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.list}>
          {dueToday.map((t, i) => {
            const status = dueStatuses[i];
            // Only a LIVE pledge earns a chip. Filtering on state matters now
            // that settled pledges are retained as records — `find` alone would
            // happily surface a months-old forfeited one as if it were running.
            const goalRow = (goals ?? []).find((g) => g.trackableId === t.id && g.state === "active");
            const gStatus = goalRow ? goalStatus(goalRow, allCompletions, todayStr) : null;
            const goalChip =
              gStatus && gStatus.state !== "missed"
                ? {
                    progress: gStatus.progress,
                    targetCount: gStatus.goal.targetCount,
                    // Coins are sitting unclaimed — worth flagging here, since
                    // Today is the screen people actually open.
                    bankable: pledgeView(gStatus.goal, gStatus.progress).bankable > 0,
                  }
                : null;
            return (
              <StaggerItem key={t.id} index={i}>
                <TrackableCard
                  trackable={t}
                  status={status}
                  skinBg={cardSkinFor(profile?.cardSkin).bg}
                  completing={completeMutation.isPending || undoMutation.isPending}
                  onEdit={() => setPanel({ mode: "edit", trackable: t })}
                  onArchive={() => setDeleteConfirm({ trackable: t, streak: status.streak })}
                  onToggleComplete={(x, y) => handleToggleComplete(t, status.isDoneToday, { x, y })}
                  goalChip={goalChip}
                />
              </StaggerItem>
            );
          })}
        </View>

      </ScrollView>

      {panel?.mode === "add" && (
        <Modal visible onRequestClose={() => setPanel(null)} variant="sheet">
            <TrackablePanel
              mode="add"
              level={progress.level}
              submitting={createMutation.isPending}
              onCancel={() => setPanel(null)}
              onSubmit={(values) => {
                createMutation.mutate(values, {
                  onSuccess: () => setPanel(null),
                  onError: (e) => Alert.alert("Couldn't add that", e.message),
                });
              }}
            />
        </Modal>
      )}

      {panel?.mode === "edit" && (
        <Modal visible onRequestClose={() => setPanel(null)} variant="sheet">
            <TrackablePanel
              mode="edit"
              initial={panel.trackable}
              level={progress.level}
              submitting={updateMutation.isPending}
              onCancel={() => setPanel(null)}
              onSubmit={(values) => {
                updateMutation.mutate(
                  { id: panel.trackable.id, values },
                  {
                    onSuccess: () => setPanel(null),
                    onError: (e) => Alert.alert("Couldn't save that", e.message),
                  }
                );
              }}
            />
        </Modal>
      )}


      <FloatingXpOverlay floats={floats} onDone={remove} />
      {levelUp !== null && (
        <LevelUpOverlay level={levelUp.level} freezeGained={levelUp.freezeGained} onClose={() => setLevelUp(null)} />
      )}
      {deleteConfirm && (
        <DeleteConfirmModal
          visible
          name={deleteConfirm.trackable.name}
          streakDays={deleteConfirm.streak}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => {
            const t = deleteConfirm.trackable;
            setDeleteConfirm(null);
            archiveMutation.mutate(t.id, {
              onError: (e: Error) => Alert.alert("Couldn't delete that", e.message),
            });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  header: {
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
    gap: 10,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mascotTile: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: "#FFE7C4",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  logo: { flex: 1, fontSize: 26, color: theme.color.ink, letterSpacing: 0.5, fontFamily: fonts.heading },
  // Coins dominate the header (filled yellow, hard offset shadow, larger mono) —
  // the payout the whole product thesis is built around gets top visual weight.
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 11,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: theme.color.yellow,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  coinText: { fontWeight: "700", fontSize: 16, color: theme.color.ink, fontFamily: fonts.mono700 },
  // Freeze tokens: an info-blue chip with white mono text.
  freezeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: theme.color.info,
  },
  freezeText: { fontWeight: "700", fontSize: 12, color: theme.on.info, fontFamily: fonts.mono700 },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  dateLabel: { fontSize: 16, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.display700 },
  welcomeBack: { fontSize: 12.5, fontWeight: "700", color: theme.color.hero, fontFamily: fonts.display600, marginTop: 4 },
  pledgeHeld: { fontSize: 11.5, fontWeight: "700", color: "rgba(36,27,51,0.6)", fontFamily: fonts.mono700, marginTop: 4 },
  pledgeReady: { fontSize: 11.5, fontWeight: "700", color: theme.color.success, fontFamily: fonts.mono700, marginTop: 4 },
  doneCountPill: {
    borderWidth: theme.borders.hairline,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 2,
    backgroundColor: theme.color.success,
  },
  doneCount: { fontSize: 11, fontWeight: "700", color: theme.on.success, fontFamily: fonts.mono700, textTransform: "uppercase", letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  list: { gap: 12 },
  error: { textAlign: "center", marginTop: 40, color: theme.color.ink, opacity: 0.7 },
  empty: {
    alignItems: "center",
    gap: 9,
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: "rgba(26,21,35,0.35)",
    borderRadius: 12,
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.display700 },
  emptyBody: { fontSize: 12.5, lineHeight: 19, color: theme.color.ink, opacity: 0.6, textAlign: "center" },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  presetChip: {
    width: "45%",
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: theme.borders.hairline,
    borderColor: theme.color.ink,
    borderRadius: 12,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  presetEmoji: { fontSize: 26 },
  presetName: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.color.ink,
    fontFamily: fonts.display600,
    textAlign: "center",
  },
  emptyCustomLink: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.color.violet,
    fontFamily: fonts.mono700,
    textDecorationLine: "underline",
    marginTop: 10,
  },
  emptyBtn: {
    marginTop: 4,
    height: 42,
    paddingHorizontal: 18,
    justifyContent: "center",
    backgroundColor: theme.color.violet,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14, fontFamily: fonts.display700 },
});
