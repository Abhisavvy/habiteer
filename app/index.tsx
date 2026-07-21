import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Plus, LogOut } from "lucide-react-native";
import { useAuth } from "@/features/auth/useAuth";
import { theme } from "@/constants/theme";
import { useTrackablesQuery, useCreateTrackable, useUpdateTrackable, useArchiveTrackable } from "@/features/trackables/useTrackables";
import { filterDueToday, today } from "@/features/trackables/today";
import { TrackableCard } from "@/features/trackables/components/TrackableCard";
import { TrackablePanel } from "@/features/trackables/components/TrackablePanel";
import type { Trackable } from "@/features/trackables/api";

type PanelState = { mode: "add" } | { mode: "edit"; trackable: Trackable } | null;

export default function Home() {
  const signOut = useAuth((s) => s.signOut);
  const { data: trackables, isLoading, error } = useTrackablesQuery();
  const createMutation = useCreateTrackable();
  const updateMutation = useUpdateTrackable();
  const archiveMutation = useArchiveTrackable();
  const [panel, setPanel] = useState<PanelState>(null);

  const dueToday = trackables ? filterDueToday(trackables, today()) : [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.logo}>HABITEER</Text>
        <Pressable style={styles.signOutBtn} onPress={signOut} aria-label="Sign out">
          <LogOut size={18} strokeWidth={3} color={theme.color.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load your habits. Pull to retry.</Text>}

        <View style={styles.list}>
          {dueToday.map((t) => (
            <TrackableCard
              key={t.id}
              trackable={t}
              onEdit={() => setPanel({ mode: "edit", trackable: t })}
              onArchive={() => archiveMutation.mutate(t.id)}
            />
          ))}
        </View>

        {panel?.mode === "add" && (
          <TrackablePanel
            mode="add"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
  },
  logo: { fontSize: 24, fontWeight: "800", color: theme.color.ink, letterSpacing: -0.5 },
  signOutBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
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
