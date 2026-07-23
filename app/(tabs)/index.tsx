import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Image, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, Path } from "react-native-svg";
import { useAddAction } from "@/features/navigation/addAction";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useTrackablesQuery, useCreateTrackable, useUpdateTrackable, useArchiveTrackable } from "@/features/trackables/useTrackables";
import { filterDueToday, today } from "@/features/trackables/today";
import { TrackableCard } from "@/features/trackables/components/TrackableCard";
import { TrackablePanel } from "@/features/trackables/components/TrackablePanel";
import type { Trackable } from "@/features/trackables/api";
import {
  useCompletionsQuery,
  useCoinBalanceQuery,
  useFreezeBalanceQuery,
  useCompleteTrackable,
  useUndoCompletion,
} from "@/features/completions/useCompletions";
import { trackableStatus, overallProgress } from "@/features/completions/derived";
import { LevelBar } from "@/features/completions/components/LevelBar";
import { useFloatingXp, FloatingXpOverlay } from "@/features/completions/components/FloatingXp";
import { LevelUpOverlay } from "@/features/completions/components/LevelUpOverlay";
import { UndoToast } from "@/features/completions/components/UndoToast";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { HardShadow } from "@/components/HardShadow";
import { useProfileQuery } from "@/features/profile/useProfile";
import { avatarColorFor, cardSkinFor } from "@/features/cosmetics/catalog";
import { useProfileQuery } from "@/features/profile/useProfile";
import { avatarColorFor, cardSkinFor } from "@/features/cosmetics/catalog";
import { useProfileQuery } from "@/features/profile/useProfile";
import { avatarColorFor, cardSkinFor } from "@/features/cosmetics/catalog";

type PanelState = { mode: "add" } | { mode: "edit"; trackable: Trackable } | null;
  const { data: profile } = useProfileQuery();

export default function Home() {
  const { data: profile } = useProfileQuery();
  const { data: trackables, isLoading, error } = useTrackablesQuery();
  const { data: completions } = useCompletionsQuery();
  const { data: profile } = useProfileQuery();
  const { data: coinBalance } = useCoinBalanceQuery();
  const { data: freezeBalance } = useFreezeBalanceQuery();
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

  const setAddHandler = useAddAction((s) => s.setHandler);
  useFocusEffect(
    useCallback(() => {
    // A done card is locked for the day — undo is only via the transient
    // toast below, never by tapping the card again.
    if (isDoneToday) return;
        if (result.xp > 0) spawn(result.xp, anchor);
        const leveledUp = lastKnownLevel.current !== null && result.level.level > lastKnownLevel.current;
        // Level-up gets its own celebratory cue; otherwise the completion cue.
        const leveledUp = lastKnownLevel.current !== null && result.level.level > lastKnownLevel.current;
        // Level-up gets its own celebratory cue; otherwise the completion cue.
        if (leveledUp) {
        // Level-up gets its own celebratory cue; otherwise the completion cue.
        if (leveledUp) {
          const freezeGained = Math.max(0, result.freezeTokens - (lastKnownFreeze.current ?? result.freezeTokens));
          setLevelUp({ level: result.level.level, freezeGained });
        }
        // Every completion (habit or task) gets the transient undo toast;
        // once it dismisses the completion is locked for the day.
        setUndoToastFor(t);
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

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Image source={require("../../assets/icon.png")} style={styles.iconMark} />
          <Text style={styles.logo}>Habiteer</Text>
          <HardShadow style={styles.coinBadge}>
            <Text style={styles.coinText}>🪙 {coinBalance ?? 0}</Text>
          <Pressable
            style={[styles.avatarBtn, { backgroundColor: avatarColorFor(profile?.avatarColor).hex }]}
            onPress={() => router.navigate("/profile")}
            aria-label="Open profile"
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={avatarColorFor(profile?.avatarColor).textColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Text style={styles.freezeText}>❄️ {freezeBalance ?? 0}</Text>
          </View>
          <Pressable
            style={[styles.avatarBtn, { backgroundColor: avatarColorFor(profile?.avatarColor).hex }]}
            onPress={() => router.navigate("/profile")}
            aria-label="Open profile"
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={avatarColorFor(profile?.avatarColor).textColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            onPress={() => router.navigate("/profile")}
            aria-label="Open profile"
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={avatarColorFor(profile?.avatarColor).textColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="12" cy="8" r="4" />
              <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </Svg>
          </Pressable>
        </View>
        <LevelBar level={progress.level} intoLevel={progress.intoLevel} need={progress.need} />
        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          {dueToday.length > 0 && (
            <Text style={styles.doneCount}>
              {doneCount} / {dueToday.length} done
            doneVerb={undoToastFor.goalType === "reduce" ? "Resisted" : "Done"}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load your habits. Pull to retry.</Text>}
            doneVerb={undoToastFor.goalType === "reduce" ? "Resisted" : "Done"}

        {undoToastFor && (
          <UndoToast
            name={undoToastFor.name}
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
            <Image source={require("../../assets/icon.png")} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyBody}>Add your first habit and start stacking streaks.</Text>
            <HardShadow style={styles.emptyBtn} onPress={() => setPanel({ mode: "add" })}>
                skinBg={cardSkinFor(profile?.cardSkin).bg}
              <Text style={styles.emptyBtnText}>＋ Add a habit</Text>
            </HardShadow>
          </View>
        )}

        <View style={styles.list}>
          {dueToday.map((t, i) => {
            const status = dueStatuses[i];
            return (
              <TrackableCard
                key={t.id}
                trackable={t}
                status={status}
                completing={completeMutation.isPending || undoMutation.isPending}
                onEdit={() => setPanel({ mode: "edit", trackable: t })}
                onArchive={() => setDeleteConfirm({ trackable: t, streak: status.streak })}
                onToggleComplete={(x, y) => handleToggleComplete(t, status.isDoneToday, { x, y })}
              />
            );
          })}
        </View>

        {panel?.mode === "add" && (
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
        )}
        {panel?.mode === "edit" && (
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
        )}

      </ScrollView>

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
  iconMark: { width: 34, height: 34, borderRadius: 9, borderWidth: 2.5, borderColor: theme.color.ink },
  logo: { flex: 1, fontSize: 20, fontWeight: "800", color: theme.color.ink, letterSpacing: -0.5, fontFamily: fonts.display700 },
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
  // Freeze tokens step down to a plain outline chip, no fill.
  freezeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: theme.color.card,
  },
  freezeText: { fontWeight: "700", fontSize: 12, color: theme.color.ink, fontFamily: fonts.mono700 },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.violet,
    alignItems: "center",
    justifyContent: "center",
  },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  dateLabel: { fontSize: 16, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.display700 },
  doneCount: { fontSize: 12, fontWeight: "700", color: theme.color.jade, fontFamily: fonts.mono700 },
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
  emptyIcon: { width: 52, height: 52, borderRadius: 13, borderWidth: theme.border, borderColor: theme.color.ink },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: theme.color.ink, fontFamily: fonts.display700 },
  emptyBody: { fontSize: 12.5, lineHeight: 19, color: theme.color.ink, opacity: 0.6, textAlign: "center" },
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
