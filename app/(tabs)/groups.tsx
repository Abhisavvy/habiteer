import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { theme } from "@/constants/theme";
import { useCompletionsQuery } from "@/features/completions/useCompletions";
import { overallProgress } from "@/features/completions/derived";
import { useMyGroupsQuery, useCreateGroup, useJoinGroup } from "@/features/groups/useGroups";
import { GroupCard } from "@/features/groups/components/GroupCard";
import { CreateOrJoinPanel } from "@/features/groups/components/CreateOrJoinPanel";

export default function Groups() {
  const { data: completions } = useCompletionsQuery();
  const { level } = overallProgress(completions ?? []);
  const { data: groups, isLoading, error } = useMyGroupsQuery();
  const createMutation = useCreateGroup();
  const joinMutation = useJoinGroup();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>GROUPS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load your groups. Pull to retry.</Text>}

        {!isLoading && groups?.length === 0 && !panelOpen && (
          <Text style={styles.empty}>No groups yet — join one with a code, or create your own.</Text>
        )}

        <View style={styles.list}>
          {groups?.map((g) => (
            <GroupCard key={g.id} group={g} onPress={() => router.push(`/group/${g.id}`)} />
          ))}
        </View>

        {panelOpen ? (
          <CreateOrJoinPanel
            level={level}
            creating={createMutation.isPending}
            joining={joinMutation.isPending}
            onCancel={() => setPanelOpen(false)}
            onCreate={(values) => {
              createMutation.mutate(values, {
                onSuccess: () => setPanelOpen(false),
                onError: (e) => Alert.alert("Couldn't create that group", e.message),
              });
            }}
            onJoin={(code) => {
              joinMutation.mutate(code, {
                onSuccess: () => setPanelOpen(false),
                onError: (e) => Alert.alert("Couldn't join that group", e.message),
              });
            }}
          />
        ) : (
          <Pressable style={styles.addBtn} onPress={() => setPanelOpen(true)}>
            <Plus size={18} strokeWidth={3} color={theme.color.ink} />
            <Text style={styles.addText}>Join or create a group</Text>
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
  title: { fontSize: 20, fontWeight: "800", color: theme.color.ink, letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  list: { gap: 12 },
  error: { textAlign: "center", marginTop: 40, color: theme.color.ink, opacity: 0.7 },
  empty: { textAlign: "center", marginTop: 24, marginBottom: 8, color: theme.color.ink, opacity: 0.7 },
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
