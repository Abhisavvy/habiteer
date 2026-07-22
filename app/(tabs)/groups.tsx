import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useAddAction } from "@/features/navigation/addAction";
import { HardShadow } from "@/components/HardShadow";
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

  const setAddHandler = useAddAction((s) => s.setHandler);
  useFocusEffect(
    useCallback(() => {
      setAddHandler(() => setPanelOpen(true));
      return () => setAddHandler(null);
    }, [setAddHandler])
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load your groups. Pull to retry.</Text>}

        {!isLoading && !error && groups?.length === 0 && !panelOpen && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>👥</Text>
            </View>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptyBody}>Join one with a code, or create your own.</Text>
            <HardShadow style={styles.emptyBtn} onPress={() => setPanelOpen(true)}>
              <Text style={styles.emptyBtnText}>＋ Join or create a group</Text>
            </HardShadow>
          </View>
        )}

        <View style={styles.list}>
          {groups?.map((g) => (
            <GroupCard key={g.id} group={g} onPress={() => router.push(`/group/${g.id}`)} />
          ))}
        </View>

        {panelOpen && (
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
  title: { fontSize: 22, fontWeight: "800", color: theme.color.ink, fontFamily: fonts.display700 },
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
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 13,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: "#EDE7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconText: { fontSize: 24 },
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
