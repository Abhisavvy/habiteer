import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { HardShadow, type HapticKind } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { getReduceMotionCached } from "@/hooks/useReduceMotion";

const SCRIM_FADE_MS = 220;
const CARD_SPRING = { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 220, mass: 0.9 };
const EXIT_MS = 180;

// Most concrete modals are conditionally MOUNTED by their parent (`{x &&
// <FooModal visible .../>}`, e.g. DeleteConfirmModal/RedeemConfirmModal) —
// there's no `visible: true -> false` prop transition to animate on close,
// the parent just unmounts the whole tree the instant a button's onPress
// fires. A couple (SignOutConfirmModal, StreakFreezeExplainerModal) instead
// stay always-mounted and toggle `visible` on the same instance. This
// context lets `ModalButton` (and the scrim's tap-to-dismiss) run the shared
// exit animation FIRST and only THEN invoke the real onPress/onRequestClose
// — the callback that actually triggers the close, either way — without any
// of the 6 concrete modals or their screens needing to know this exists.
const ModalExitContext = createContext<((cb: () => void) => void) | null>(null);

/**
 * Shared modal shell — ink scrim + bordered/shadowed card — replacing
 * scattered Alert.alert() calls. Compose with ModalButton and whatever
 * icon/title/body markup the specific confirmation needs; the shell only
 * owns the scrim, card frame, and dismiss-on-scrim-tap behavior.
 *
 * Animates in (scrim fade + card slide-up/spring) on mount and animates out
 * (via `ModalExitContext`) before any close/confirm actually fires — both
 * skipped under the OS reduce-motion setting, which snaps straight to the
 * final state either way.
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
  const reduceMotion = getReduceMotionCached();
  const scrimAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  // Most of the 6 concrete modals are conditionally MOUNTED (`{x && <Foo
  // visible .../>}`), so `visible` is a constant `true` for this instance's
  // whole life. Two (SignOutConfirmModal, StreakFreezeExplainerModal) stay
  // always-mounted and toggle `visible` on the same instance instead — this
  // has to handle both: `closed` inits from the CURRENT `visible` so an
  // already-open always-mounted modal doesn't flash hidden-then-shown, and
  // the effect below resets it (and replays the entrance) on every
  // false->true transition, not just first mount.
  const [closed, setClosed] = useState(!visible);

  useEffect(() => {
    if (!visible) return;
    setClosed(false);
    if (reduceMotion !== false) {
      scrimAnim.setValue(1);
      cardAnim.setValue(1);
      return;
    }
    scrimAnim.setValue(0);
    cardAnim.setValue(0);
    Animated.timing(scrimAnim, { toValue: 1, duration: SCRIM_FADE_MS, useNativeDriver: true }).start();
    Animated.spring(cardAnim, CARD_SPRING).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animateOutThenCall = (cb: () => void) => {
    if (reduceMotion !== false) {
      cb();
      return;
    }
    Animated.parallel([
      Animated.timing(scrimAnim, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }),
    ]).start(() => {
      // Guards against the parent unmounting mid-animation for some other
      // reason (e.g. navigating away) and this callback firing on a gone tree.
      setClosed(true);
      cb();
    });
  };

  if (!visible || closed) return null;

  return (
    <ModalExitContext.Provider value={animateOutThenCall}>
      <View style={styles.scrim}>
        <Animated.View style={[StyleSheet.absoluteFillObject, styles.scrimTint, { opacity: scrimAnim }]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => animateOutThenCall(onRequestClose)} />
        <Animated.View
          style={{
            width: "100%",
            alignItems: "center",
            opacity: cardAnim,
            transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          }}
        >
          <HardShadow style={styles.card} onPress={(e) => e.stopPropagation()} haptic="none">
            {children}
          </HardShadow>
        </Animated.View>
      </View>
    </ModalExitContext.Provider>
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

// A variant that commits to a real action (redeem, delete, sign out) gets a
// weightier MEDIUM haptic; one that just dismisses or acknowledges (cancel,
// "got it", "keep earning") stays at HardShadow's LIGHT default.
const VARIANT_HAPTIC: Record<keyof typeof VARIANT_STYLE, HapticKind> = {
  cancel: "light",
  fire: "medium",
  jade: "medium",
  violet: "light",
  info: "light",
  ink: "medium",
};

export function ModalButton({
  label,
  onPress,
  variant,
  full,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant: keyof typeof VARIANT_STYLE;
  /** Single-button confirmations (insufficient-funds, streak-freeze) span the full card width instead of sharing a row. */
  full?: boolean;
  /** Blocks the press AND the exit animation — a disabled confirm must not
   * close the modal, or the action reads as having been accepted. */
  disabled?: boolean;
}) {
  const v = VARIANT_STYLE[variant];
  const requestExit = useContext(ModalExitContext);
  return (
    <HardShadow
      style={[
        styles.button,
        !full && { flex: 1 },
        { backgroundColor: v.backgroundColor, shadowColor: v.shadowColor },
        disabled && styles.buttonDisabled,
      ]}
      onPress={disabled ? undefined : () => (requestExit ? requestExit(onPress) : onPress())}
      disabled={disabled}
      haptic={VARIANT_HAPTIC[variant]}
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
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 50,
  },
  scrimTint: { backgroundColor: "rgba(26,21,35,0.72)" },
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
  buttonDisabled: { opacity: 0.45 },
});
