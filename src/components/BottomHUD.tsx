import { View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useAddAction } from "@/features/navigation/addAction";

const TABS: { name: string; label: string }[] = [
  { name: "index", label: "Today" },
  { name: "rewards", label: "Rewards" },
  { name: "leaderboard", label: "Board" },
  { name: "groups", label: "Groups" },
];

/** Icon paths extracted verbatim from the design's BottomHUD component (S9), except
 * "groups" — that tab postdates the mockup, so it's a hand-drawn addition matching
 * the same stroke language (2.2 width, round caps/joins). */
function TabIcon({ name, color }: { name: string; color: string }) {
  switch (name) {
    case "index":
      return (
        <Svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="3" y="4" width="18" height="17" rx="3" />
          <Path d="M3 9h18M8 2v4M16 2v4" />
          <Path d="M8.5 15l2.2 2.2 4-4.4" />
        </Svg>
      );
    case "rewards":
      return (
        <Svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="3" y="8" width="18" height="13" rx="2" />
          <Path d="M3 12h18M12 8v13" />
          <Path d="M12 8S9 3 6.5 4.5 9 8 12 8zM12 8s3-5 5.5-3.5S15 8 12 8z" />
        </Svg>
      );
    case "leaderboard":
      return (
        <Svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M7 21V11M12 21V4M17 21v-6" />
          <Path d="M4 21h16" />
        </Svg>
      );
    case "groups":
      return (
        <Svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="9" cy="8" r="3.2" />
          <Path d="M2.3 20c0-3.6 3-5.6 6.7-5.6s6.7 2 6.7 5.6" />
          <Path d="M15.7 8.3a3 3 0 010 5.6" />
          <Path d="M21.7 20c0-2.9-2.1-4.7-4.6-5.4" />
        </Svg>
      );
    default:
      return null;
  }
}

/**
 * Custom bottom tab bar matching the design's BottomHUD (S9): 4 tabs
 * (Today/Rewards/Board/Groups) + a raised center "+". Profile moved off
 * the tab bar entirely — reachable via the avatar button on Today — so
 * this is back to the mockup's exact 5-slot structure (2 tabs, "+", 2
 * tabs); Groups (postdating the design) fills the slot the mockup's own
 * "Profile" tab occupied, using a hand-drawn icon in the same stroke
 * language rather than the mockup's Profile icon.
 */
export function BottomHUD({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const handler = useAddAction((s) => s.handler);
  const trigger = useAddAction((s) => s.trigger);

  return (
    <View style={styles.wrap}>
      {handler && (
        <View style={styles.floatWrap} pointerEvents="box-none">
          <HardShadow style={styles.floatBtn} onPress={trigger} aria-label="Add">
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </HardShadow>
        </View>
      )}
      <View style={[styles.bar, { paddingBottom: 12 + insets.bottom }]}>
        {TABS.map((tab) => {
          const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
          if (routeIndex === -1) return null;
          const route = state.routes[routeIndex];
          const isFocused = state.index === routeIndex;
          const color = isFocused ? theme.color.violet : "rgba(26,21,35,0.4)";
          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              aria-label={tab.label}
            >
              <TabIcon name={tab.name} color={color} />
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  floatWrap: { position: "absolute", top: -24, left: 0, right: 0, alignItems: "center", zIndex: 1 },
  floatBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.color.violet,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderTopWidth: theme.border,
    borderTopColor: theme.color.ink,
    paddingTop: 10,
    paddingHorizontal: 18,
  },
  tab: { width: 56, alignItems: "center", gap: 4 },
  label: { fontWeight: "700", fontSize: 10, fontFamily: fonts.mono700 },
});
