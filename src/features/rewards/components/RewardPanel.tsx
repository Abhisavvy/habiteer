import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
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
  const [cost, setCost] = useState(initial?.cost ?? 50);

  const canSubmit = name.trim().length > 0 && cost > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), emoji, cost });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{mode === "add" ? "New reward" : "Edit reward"}</Text>
        <Pressable style={styles.closeBtn} onPress={onCancel} aria-label="Close">
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <HardShadow style={styles.panel}>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Name your reward…"
            placeholderTextColor="rgba(26,21,35,0.4)"
            value={name}
            onChangeText={setName}
            maxLength={28}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.emojiRow}>
              {EMOJI_CHOICES.map((e) => (
                <HardShadow
                  key={e}
                  style={[styles.emojiBtn, emoji === e && styles.emojiBtnSelected]}
                  onPress={() => setEmoji(e)}
                >
                  <Text style={styles.emojiText}>{e}</Text>
                </HardShadow>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Cost</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepperBtn} onPress={() => setCost((v) => Math.max(1, v - 10))}>
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>🪙 {cost}</Text>
            <Pressable style={styles.stepperBtn} onPress={() => setCost((v) => v + 10)}>
              <Text style={styles.stepperBtnText}>＋</Text>
            </Pressable>
          </View>
        </View>
      </HardShadow>

      <View style={styles.actionsRow}>
        <HardShadow style={styles.ghostBtn} onPress={onCancel}>
          <Text style={styles.ghostText}>Cancel</Text>
        </HardShadow>
        <HardShadow style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]} disabled={!canSubmit || submitting} onPress={submit}>
          <Text style={styles.primaryText}>{mode === "add" ? "Add it" : "Save"}</Text>
        </HardShadow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: theme.color.ink, fontFamily: fonts.display700 },
  closeBtn: {
    width: 34,
    height: 34,
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    backgroundColor: "#fff",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontWeight: "700", fontSize: 16, color: theme.color.ink, fontFamily: fonts.display700 },
  panel: {
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 15,
    gap: 15,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  row: { gap: 7 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(26,21,35,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: fonts.mono700,
  },
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
  emojiRow: { flexDirection: "row", gap: 7 },
  emojiBtn: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: "rgba(26,21,35,0.25)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBtnSelected: {
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.yellow,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  emojiText: { fontSize: 20 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2.5,
    borderColor: theme.color.ink,
    borderRadius: 10,
    backgroundColor: theme.color.paper,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  stepperBtn: { width: 36, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  stepperBtnText: { fontWeight: "700", fontSize: 18, color: theme.color.ink, fontFamily: fonts.display700 },
  stepperValue: {
    minWidth: 80,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
    color: theme.color.ink,
    fontFamily: fonts.mono700,
    paddingHorizontal: 8,
  },
  actionsRow: { flexDirection: "row", gap: 12, marginTop: 2 },
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
