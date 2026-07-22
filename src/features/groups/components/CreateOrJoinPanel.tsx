import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { theme } from "@/constants/theme";
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
    <View style={styles.panel}>
      <View style={styles.buttonRow}>
        {(["join", "create"] as const).map((m) => (
          <Pressable
            key={m}
            style={[styles.choiceBtn, mode === m && styles.choiceBtnSelected]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.choiceText, mode === m && styles.choiceTextSelected]}>
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
          <TextInput
            style={styles.input}
            placeholder="Group name"
            value={name}
            onChangeText={setName}
            maxLength={40}
          />
          {level < GROUP_CREATE_LEVEL && (
            <Text style={styles.hint}>
              Reach level {GROUP_CREATE_LEVEL} to create a group — you're level {level}.
            </Text>
          )}
        </>
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.ghostBtn} onPress={onCancel}>
          <Text style={styles.ghostText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[
            styles.primaryBtn,
            !(mode === "join" ? canJoin : canCreate) && styles.primaryBtnDisabled,
          ]}
          disabled={!(mode === "join" ? canJoin : canCreate) || creating || joining}
          onPress={submit}
        >
          <Text style={styles.primaryText}>{mode === "join" ? "Join" : "Create"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 14,
    gap: 12,
  },
  buttonRow: { flexDirection: "row", gap: 8 },
  choiceBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    backgroundColor: "#fff",
  },
  choiceBtnSelected: { backgroundColor: theme.color.violet },
  choiceText: { fontWeight: "700", fontSize: 13, color: theme.color.ink },
  choiceTextSelected: { color: "#fff" },
  input: {
    fontWeight: "600",
    fontSize: 16,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    color: theme.color.ink,
  },
  hint: { fontSize: 12, fontWeight: "600", color: theme.color.fire },
  actionsRow: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  ghostBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: "#fff",
  },
  ghostText: { fontWeight: "700", fontSize: 14, color: theme.color.ink },
  primaryBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.violet,
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryText: { fontWeight: "700", fontSize: 14, color: "#fff" },
});
