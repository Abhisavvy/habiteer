import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { theme } from "@/constants/theme";
import type { Reward } from "../api";
import type { RewardFormValues } from "../schemas";

const EMOJI_CHOICES = ["🎁", "🍕", "🎮", "🎬", "🛍️", "🧁", "🏖️", "🎧", "📱", "☕"];

export function RewardPanel({
  mode,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  mode: "add" | "edit";
  initial?: Reward;
  onSubmit: (values: RewardFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJI_CHOICES[0]);
  const [cost, setCost] = useState(String(initial?.cost ?? 50));

  const canSubmit = name.trim().length > 0 && Number(cost) > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), emoji, cost: Number(cost) });
  };

  return (
    <View style={styles.panel}>
      <TextInput
        style={styles.input}
        placeholder="Name your reward…"
        value={name}
        onChangeText={setName}
        maxLength={28}
      />

      <View style={styles.row}>
        <Text style={styles.label}>Icon</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.emojiRow}>
            {EMOJI_CHOICES.map((e) => (
              <Pressable
                key={e}
                style={[styles.emojiBtn, emoji === e && styles.emojiBtnSelected]}
                onPress={() => setEmoji(e)}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Cost (coins)</Text>
        <TextInput style={styles.costInput} value={cost} onChangeText={setCost} keyboardType="number-pad" />
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.ghostBtn} onPress={onCancel}>
          <Text style={styles.ghostText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
          disabled={!canSubmit || submitting}
          onPress={submit}
        >
          <Text style={styles.primaryText}>{mode === "add" ? "Add it" : "Save"}</Text>
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
  row: { gap: 7 },
  label: { fontSize: 12, fontWeight: "700", opacity: 0.6, color: theme.color.ink },
  emojiRow: { flexDirection: "row", gap: 7 },
  emojiBtn: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  emojiBtnSelected: { backgroundColor: theme.color.yellow },
  emojiText: { fontSize: 18 },
  costInput: {
    fontWeight: "700",
    fontSize: 15,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 9,
    padding: 8,
    backgroundColor: "#fff",
    color: theme.color.ink,
    width: 110,
  },
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
