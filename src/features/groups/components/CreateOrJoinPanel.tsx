import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import type { GroupFormValues } from "../schemas";

// PLAN.md §9 — mirrors the "create groups at level 3" WITH CHECK in rls.sql.
// The server is authoritative; this only swaps a raw RLS error for a friendly
// message before the request goes out.
const GROUP_CREATE_LEVEL = 3;

export function CreateOrJoinPanel({
  level,
  onCreate,
  onJoin,
  onCancel,
  creating,
  joining,
}: {
  level: number;
  onCreate: (values: GroupFormValues) => void;
  onJoin: (code: string) => void;
  onCancel: () => void;
  creating?: boolean;
  joining?: boolean;
}) {
  const [mode, setMode] = useState<"join" | "create">("join");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const canCreate = level >= GROUP_CREATE_LEVEL && name.trim().length > 0;
  const canJoin = code.trim().length > 0;

  const submit = () => {
    if (mode === "join") {
      if (!canJoin) return;
      onJoin(code.trim());
    } else {
      if (!canCreate) return;
      onCreate({ name: name.trim() });
    }
  };

  return (
    <HardShadow style={styles.panel}>
      <View style={styles.segmented}>
        {(["join", "create"] as const).map((m) => (
          <Pressable key={m} style={[styles.segment, mode === m && styles.segmentSelected]} onPress={() => setMode(m)}>
            <Text style={[styles.segmentText, mode === m && styles.segmentTextSelected]}>
              {m === "join" ? "Join a group" : "Create a group"}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "join" ? (
        <TextInput
          style={styles.input}
          placeholder="Invite code"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />
      ) : (
        <>
          <TextInput style={styles.input} placeholder="Group name" value={name} onChangeText={setName} maxLength={40} />
          {level < GROUP_CREATE_LEVEL && (
            <Text style={styles.hint}>
              Reach level {GROUP_CREATE_LEVEL} to create a group — you're level {level}.
            </Text>
          )}
        </>
      )}

      <View style={styles.actionsRow}>
        <HardShadow style={styles.ghostBtn} onPress={onCancel}>
          <Text style={styles.ghostText}>Cancel</Text>
        </HardShadow>
        <HardShadow
          style={[styles.primaryBtn, !(mode === "join" ? canJoin : canCreate) && styles.primaryBtnDisabled]}
          disabled={!(mode === "join" ? canJoin : canCreate) || creating || joining}
          onPress={submit}
        >
          <Text style={styles.primaryText}>{mode === "join" ? "Join" : "Create"}</Text>
        </HardShadow>
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 16,
    gap: 12,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: theme.color.paper,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    borderRadius: 11,
    padding: 4,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 8 },
  segmentSelected: { backgroundColor: theme.color.violet },
  segmentText: { fontWeight: "700", fontSize: 13, color: "rgba(26,21,35,0.55)", fontFamily: fonts.display700 },
  segmentTextSelected: { color: "#fff" },
  input: {
    fontWeight: "600",
    fontSize: 15,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    borderRadius: 10,
    padding: 11,
    backgroundColor: theme.color.paper,
    color: theme.color.ink,
    fontFamily: fonts.display600,
  },
  hint: { fontSize: 12, fontWeight: "700", color: theme.color.fire, fontFamily: fonts.mono700 },
  actionsRow: { flexDirection: "row", gap: 10 },
  ghostBtn: {
    flex: 1,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: "#fff",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  ghostText: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  primaryBtn: {
    flex: 1.4,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.jade,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryText: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
});
