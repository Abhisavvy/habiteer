import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";

/**
 * Shared modal shell — ink scrim + bordered/shadowed card — replacing
 * scattered Alert.alert() calls. Compose with ModalButton and whatever
 * icon/title/body markup the specific confirmation needs; the shell only
 * owns the scrim, card frame, and dismiss-on-scrim-tap behavior.
 */
export function Modal({
  visible,
  onRequestClose,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  if (!visible) return null;
  return (
    <Pressable style={styles.scrim} onPress={onRequestClose}>
      <HardShadow style={styles.card} onPress={(e) => e.stopPropagation()}>
        {children}
      </HardShadow>
    </Pressable>
  );
}

export function ModalIcon({ emoji, badge }: { emoji: string; badge?: { shape: "circle" | "rounded"; bg: string } }) {
  if (!badge) return <Text style={styles.bareIcon}>{emoji}</Text>;
  return (
    <View
      style={[styles.iconBadge, { backgroundColor: badge.bg, borderRadius: badge.shape === "circle" ? 26 : 13 }]}
    >
      <Text style={styles.badgeIconText}>{emoji}</Text>
    </View>
  );
}

export function ModalTitle({ children, color }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.title, color ? { color } : null]}>{children}</Text>;
}

export function ModalBody({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

// Color-coded action buttons (mock 05). Colored fills carry white text; the
// cancel/keep button is a plain surface chip with ink text.
const VARIANT_STYLE = {
  cancel: { backgroundColor: theme.color.surface, color: theme.color.ink, shadowColor: theme.color.ink },
  fire: { backgroundColor: theme.color.danger, color: theme.on.danger, shadowColor: theme.color.ink },
  jade: { backgroundColor: theme.color.success, color: theme.on.success, shadowColor: theme.color.ink },
  violet: { backgroundColor: theme.color.hero, color: theme.on.hero, shadowColor: theme.color.ink },
  info: { backgroundColor: theme.color.info, color: theme.on.info, shadowColor: theme.color.ink },
  ink: { backgroundColor: theme.color.ink, color: theme.color.paper, shadowColor: theme.color.ink },
} as const;

export function ModalButton({
  label,
  onPress,
  variant,
  full,
}: {
  label: string;
  onPress: () => void;
  variant: keyof typeof VARIANT_STYLE;
  /** Single-button confirmations (insufficient-funds, streak-freeze) span the full card width instead of sharing a row. */
  full?: boolean;
}) {
  const v = VARIANT_STYLE[variant];
  return (
    <HardShadow
      style={[styles.button, !full && { flex: 1 }, { backgroundColor: v.backgroundColor, shadowColor: v.shadowColor }]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, { color: v.color }]}>{label}</Text>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(26,21,35,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 50,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: theme.color.surface,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 6,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  bareIcon: { fontSize: 40 },
  iconBadge: {
    width: 52,
    height: 52,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeIconText: { fontSize: 24 },
  title: { fontWeight: "800", fontSize: 19, color: theme.color.ink, marginTop: 6, fontFamily: fonts.display700, textAlign: "center" },
  body: { fontSize: 13, lineHeight: 19.5, color: "rgba(26,21,35,0.65)", textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12, width: "100%" },
  button: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 11,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  buttonText: { fontWeight: "700", fontSize: 14, fontFamily: fonts.display700 },
});
