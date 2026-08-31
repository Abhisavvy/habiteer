import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useAddAction } from "@/features/navigation/addAction";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
import { useCompletionsQuery } from "@/features/completions/useCompletions";
import { overallProgress } from "@/features/completions/derived";
import { useMyGroupsQuery, useCreateGroup, useJoinGroup } from "@/features/groups/useGroups";
import { GroupCard } from "@/features/groups/components/GroupCard";
import { CreateOrJoinPanel } from "@/features/groups/components/CreateOrJoinPanel";
import { Modal } from "@/components/Modal";

export default function Groups() {
  const { data: completions } = useCompletionsQuery();
  const { level } = overallProgress(completions ?? []);
  const { data: groups, isLoading, error } = useMyGroupsQuery();
  const createMutation = useCreateGroup();
  const joinMutation = useJoinGroup();
  const [panelOpen, setPanelOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const setAddHandler = useAddAction((s) => s.setHandler);
  useFocusEffect(
    useCallback(() => {
      setAddHandler(() => setPanelOpen(true));
      return () => setAddHandler(null);
    }, [setAddHandler])
  );

  const submitJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    joinMutation.mutate(code, {
      onSuccess: () => setJoinCode(""),
      onError: (e) => Alert.alert("Couldn't join that group", e.message),
    });
  };

  return (
    <View style={styles.root}>
      <Halftone color={theme.color.ink} opacity={0.1} id="groups-bg" />
      <View style={styles.header}>
        <Text style={styles.title}>GROUPS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading && <ActivityIndicator style={{ marginTop: 40 }} />}
        {error && <Text style={styles.error}>Couldn't load your groups. Pull to retry.</Text>}

        {groups && groups.length > 0 && (
          <View style={styles.list}>
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} onPress={() => router.push(`/group/${g.id}`)} />
            ))}
          </View>
        )}

        {!isLoading && !error && groups?.length === 0 && (
          <Text style={styles.emptyNote}>No groups yet — join one with a code, or create your own.</Text>
        )}

        {/* Inline "Join a party" (mock 04) */}
        <View style={styles.joinPanel}>
          <Text style={styles.joinTitle}>JOIN A PARTY</Text>
          <TextInput
            style={styles.codeInput}
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="ENTER CODE"
            placeholderTextColor="rgba(36,27,51,0.5)"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={submitJoin}
          />
          <HardShadow style={styles.joinBtn} onPress={submitJoin} disabled={joinMutation.isPending} aria-label="Join group">
            <Text style={styles.joinBtnText}>Join</Text>
          </HardShadow>
        </View>

        <Pressable style={styles.createBtn} onPress={() => setPanelOpen(true)} aria-label="Create a group">
          <Text style={styles.createPlus}>+</Text>
          <Text style={styles.createText}>Create a group</Text>
        </Pressable>
      </ScrollView>

      {panelOpen && (
        <Modal visible onRequestClose={() => setPanelOpen(false)} variant="sheet">
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
        </Modal>
      )}

    </View>
  );
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  header: { paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12 },
  title: { fontSize: 26, color: INK, letterSpacing: 0.5, fontFamily: fonts.heading },
  scroll: { paddingHorizontal: 14, paddingBottom: 40, gap: 14 },
  list: { gap: 12 },
  error: { textAlign: "center", marginTop: 40, color: INK, opacity: 0.7 },
  emptyNote: { fontSize: 13, lineHeight: 19, color: INK, opacity: 0.6, textAlign: "center", marginTop: 8 },

  joinPanel: {
    backgroundColor: "#EDE7FF",
    borderWidth: theme.borders.standard,
    borderColor: theme.color.hero,
    borderRadius: 14,
    padding: 14,
    gap: 11,
  },
  joinTitle: { fontSize: 18, color: theme.color.hero, fontFamily: fonts.heading, letterSpacing: 0.5 },
  codeInput: {
    height: 46,
    backgroundColor: "#fff",
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 11,
    paddingHorizontal: 13,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 2,
    color: INK,
    fontFamily: fonts.mono700,
  },
  joinBtn: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.hero,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 11,
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  joinBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, fontFamily: fonts.display700 },

  createBtn: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: theme.color.hero,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  createPlus: { fontSize: 20, color: theme.color.hero, fontFamily: fonts.heading },
  createText: { fontSize: 14, fontWeight: "700", color: theme.color.hero, fontFamily: fonts.display700 },
});
