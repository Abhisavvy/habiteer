import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, Pressable, Platform, StatusBar } from "react-native";
import * as Haptics from "expo-haptics";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useConnectionToast } from "@/features/system/connectionToast";

const VISIBLE_MS = 4500;

/**
 * Global "couldn't reach the server / not saved" banner. Slides in from the
 * top when a query or mutation fails on the network, fires a warning haptic,
 * and auto-dismisses (tap to dismiss early). Rendered once at the app root.
 */
export function ConnectionToast() {
  const message = useConnectionToast((s) => s.message);
  const clear = useConnectionToast((s) => s.clear);
  const topInset = (StatusBar.currentHeight ?? 24) + 8; // Android status-bar height; no SafeAreaProvider in this app
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (reduceMotion) {
      anim.setValue(1);
    } else {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 180 }).start();
    }
    timer.current = setTimeout(dismiss, VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const dismiss = () => {
    if (reduceMotion) {
      clear();
      return;
    }
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => clear());
  };

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingTop: topInset },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        },
      ]}
    >
      <Pressable style={styles.card} onPress={dismiss} aria-label="Dismiss">
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.text}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 14,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 520,
    width: "100%",
    backgroundColor: theme.color.fire,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  icon: { fontSize: 18 },
  text: { flex: 1, fontWeight: "700", fontSize: 13, color: "#fff", fontFamily: fonts.display600 },
});
