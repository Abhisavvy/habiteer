import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Plus, LogOut, Snowflake } from "lucide-react-native";
import { useAuth } from "@/features/auth/useAuth";
import { theme } from "@/constants/theme";
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

type PanelState = { mode: "add" } | { mode: "edit"; trackable: Trackable } | null;

export default function Home() {
  const signOut = useAuth((s) => s.signOut);
  const { data: trackables, isLoading, error } = useTrackablesQuery();
  const { data: completions } = useCompletionsQuery();
  const { data: coinBalance } = useCoinBalanceQuery();
  const { data: freezeBalance } = useFreezeBalanceQuery();
  const createMutation = useCreateTrackable();
  const updateMutation = useUpdateTrackable();
  const archiveMutation = useArchiveTrackable();
  const completeMutation = useCompleteTrackable();
  const undoMutation = useUndoCompletion();
  const [panel, setPanel] = useState<PanelState>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [undoToastFor, setUndoToastFor] = useState<Trackable | null>(null);
  const { floats, spawn, remove } = useFloatingXp();
  const lastKnownLevel = useRef<number | null>(null);

  const todayStr = today();
  const dueToday = trackables ? filterDueToday(trackables, todayStr) : [];
  const allCompletions = completions ?? [];
  const progress = overallProgress(allCompletions);

  useEffect(() => {
    if (lastKnownLevel.current === null) lastKnownLevel.current = progress.level;
  }, [progress.level]);

  const handleToggleComplete = (t: Trackable, isDoneToday: boolean) => {
    if (isDoneToday) {
      undoMutation.mutate(t.id, {
        onError: (e: Error) => Alert.alert("Couldn't undo that", e.message),
      });
      return;
    }
    completeMutation.mutate(t.id, {
      onSuccess: (result) => {
        if (result.xp > 0) spawn(result.xp);
        if (lastKnownLevel.current !== null && result.level.level > lastKnownLevel.current) {
          setLevelUp(result.level.level);
        }
        lastKnownLevel.current = result.level.level;
        if (t.kind === "task") setUndoToastFor(t);
      },
      onError: (e: Error) => Alert.alert("Couldn't complete that", e.message),
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Text style={styles.logo}>HABITEER</Text>
          <View style={styles.headerRight}>
            <View style={styles.statBadge}>
              <Text style={styles.statText}>🪙 {coinBalance ?? 0}</Text>
            </View>
            <View style={styles.statBadge}>
              <Snowflake size={13} strokeWidth={3} color={theme.color.violet} />
              <Text style={styles.statText}>{freezeBalance ?? 0}</Text>
            </View>
            <Pressable style={styles.signOutBtn} onPress={signOut} aria-label="Sign out">
              <LogOut size={16} strokeWidth={3} color={theme.color.ink} />
            </Pressable>
          </View>
        </View>
        <LevelBar level={progress.level} intoLevel={progress.intoLevel} need={progress.need} />
        <FloatingXpOverlay floats={floats} onDone={remove} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load your habits. Pull to retry.</Text>}

        {undoToastFor && (
          <UndoToast
            onUndo={() => {
              undoMutation.mutate(undoToastFor.id, {
                onError: (e: Error) => Alert.alert("Couldn't undo that", e.message),
              });
            }}
            onDismiss={() => setUndoToastFor(null)}
          />
        )}

        <View style={styles.list}>
          {dueToday.map((t) => {
            const status = trackableStatus(t, allCompletions, todayStr);
            return (
              <TrackableCard
                key={t.id}
                trackable={t}
                status={status}
                completing={completeMutation.isPending || undoMutation.isPending}
                onEdit={() => setPanel({ mode: "edit", trackable: t })}
                onArchive={() => archiveMutation.mutate(t.id)}
                onToggleComplete={() => handleToggleComplete(t, status.isDoneToday)}
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

        {!panel && (
          <Pressable style={styles.addBtn} onPress={() => setPanel({ mode: "add" })}>
            <Plus size={18} strokeWidth={3} color={theme.color.ink} />
            <Text style={styles.addText}>Add habit or task</Text>
          </Pressable>
        )}
      </ScrollView>

      {levelUp !== null && <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />}
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
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 22, fontWeight: "800", color: theme.color.ink, letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: theme.color.card,
  },
  statText: { fontWeight: "700", fontSize: 12, color: theme.color.ink },
  signOutBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.card,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  list: { gap: 12 },
  error: { textAlign: "center", marginTop: 40, color: theme.color.ink, opacity: 0.7 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderStyle: "dashed",
    borderRadius: theme.radius,
    paddingVertical: 14,
    backgroundColor: theme.color.card,
  },
  addText: { fontWeight: "700", fontSize: 15, color: theme.color.ink },
});
