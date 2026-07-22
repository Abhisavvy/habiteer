import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { theme } from "@/constants/theme";

/** Brief "Done ✓ — Undo" snackbar shown after completing a task, since it
 * archives and leaves the list immediately — there's no card left to tap. */
export function UndoToast({ onUndo, onDismiss }: { onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <View style={styles.toast}>
      <Text style={styles.text}>Done ✓</Text>
      <Pressable
        onPress={() => {
          onUndo();
          onDismiss();
        }}
      >
        <Text style={styles.undo}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.color.ink,
    borderRadius: theme.radius,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: { color: "#fff", fontWeight: "700", fontSize: 14 },
  undo: { color: theme.color.yellow, fontWeight: "800", fontSize: 14 },
});
