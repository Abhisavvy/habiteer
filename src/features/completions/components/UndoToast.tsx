import { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { Check } from "lucide-react-native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/** Brief "Done · {name} — UNDO" snackbar shown after completing a task, since it
 * archives and leaves the list immediately — there's no card left to tap. */
export function UndoToast({
  name,
  onUndo,
  onDismiss,
  doneVerb = "Done",
}: {
  name: string;
  onUndo: () => void;
  onDismiss: () => void;
  doneVerb?: string;
}) {
  const reduceMotion = useReduceMotion();
  const translateY = useRef(new Animated.Value(20)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const dismiss = () => {
    if (reduceMotion) {
      onDismiss();
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, { toValue: 20, duration: 160, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(({ finished }) => finished && onDismiss());
  };

  useEffect(() => {
    if (reduceMotion === null) return; // still checking

    if (reduceMotion) {
      translateY.setValue(0);
      fade.setValue(1);
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }

    const t = setTimeout(dismiss, 4000);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  if (reduceMotion === null) return null;

  return (
    <Animated.View style={[styles.toast, { opacity: fade, transform: [{ translateY }] }]}>
      <View style={styles.checkBadge}>
        <Check size={14} strokeWidth={3.5} color={theme.color.ink} />
      </View>
      <Text style={styles.text} numberOfLines={1}>
        {doneVerb} · {name}
      </Text>
      <Pressable
        onPress={() => {
          onUndo();
          dismiss();
        }}
      >
        <Text style={styles.undo}>UNDO</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.ink,
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.color.jade,
    borderWidth: 2,
    borderColor: theme.color.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, color: theme.color.paper, fontWeight: "700", fontSize: 13, fontFamily: fonts.display700 },
  undo: { color: theme.color.gold, fontSize: 15, fontFamily: fonts.heading, letterSpacing: 0.5 },
});
