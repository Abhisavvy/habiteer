import { View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useAddAction } from "@/features/navigation/addAction";
import { feedbackLight } from "@/features/feedback/feedback";

const TABS: { name: string; label: string }[] = [
  { name: "index", label: "Today" },
  { name: "rewards", label: "Rewards" },
  { name: "leaderboard", label: "Board" },
  { name: "groups", label: "Groups" },
];

const ACTIVE = theme.color.gold;
const INACTIVE = "rgba(247,236,211,0.55)"; // parchment @55% on the dark bar

/**
 * Per-tab icon with a solid-gold FILLED form when the tab is active and a
 * parchment-dim OUTLINE form when it isn't — matching the mockup's HUD, where
 * the current tab reads as a bold filled glyph and the rest as thin outlines.
 */
function TabIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? ACTIVE : INACTIVE;
  const S = 24;
  const stroke = { fill: "none", stroke: color, strokeWidth: 2.1, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case "index": // house
      return active ? (
        <Svg width={S} height={S} viewBox="0 0 24 24">
          <Path d="M3 11.2 12 3l9 8.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill={color} />
        </Svg>
      ) : (
        <Svg width={S} height={S} viewBox="0 0 24 24">
          <Path d="M3 11.2 12 3l9 8.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" {...stroke} />
        </Svg>
      );
    case "rewards": // gift
      return active ? (
        <Svg width={S} height={S} viewBox="0 0 24 24">
          <Rect x="3.2" y="7.2" width="17.6" height="4.2" rx="1.2" fill={color} />
          <Path d="M4.7 11.4h14.6V20a1 1 0 0 1-1 1H5.7a1 1 0 0 1-1-1z" fill={color} />
          <Path d="M12 7.2C12 7.2 10 3.3 8 4.6 6.4 5.6 9.1 7.2 12 7.2Z" fill={color} />
          <Path d="M12 7.2C12 7.2 14 3.3 16 4.6 17.6 5.6 14.9 7.2 12 7.2Z" fill={color} />
          <Rect x="10.8" y="7.2" width="2.4" height="13.8" fill={theme.color.ink} />
        </Svg>
      ) : (
        <Svg width={S} height={S} viewBox="0 0 24 24">
          <Rect x="3.4" y="7.4" width="17.2" height="4" rx="1.2" {...stroke} />
          <Path d="M5 11.4V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8.6" {...stroke} />
          <Path d="M12 7.4V21" {...stroke} />
          <Path d="M12 7.4S9.8 3.6 7.9 4.8 9.4 7.4 12 7.4Z" {...stroke} />
          <Path d="M12 7.4s2.2-3.8 4.1-2.6S14.6 7.4 12 7.4Z" {...stroke} />
        </Svg>
      );
    case "leaderboard": // bar chart
      return active ? (
        <Svg width={S} height={S} viewBox="0 0 24 24">
          <Rect x="3" y="13" width="4.6" height="8" rx="1.2" fill={color} />
          <Rect x="9.7" y="8" width="4.6" height="13" rx="1.2" fill={color} />
          <Rect x="16.4" y="3.5" width="4.6" height="17.5" rx="1.2" fill={color} />
        </Svg>
      ) : (
        <Svg width={S} height={S} viewBox="0 0 24 24">
          <Rect x="3" y="13" width="4.6" height="8" rx="1.2" {...stroke} />
          <Rect x="9.7" y="8" width="4.6" height="13" rx="1.2" {...stroke} />
          <Rect x="16.4" y="3.5" width="4.6" height="17.5" rx="1.2" {...stroke} />
        </Svg>
      );
    case "groups": // two people
      return active ? (
        <Svg width={S} height={S} viewBox="0 0 24 24">
          <Circle cx="16.4" cy="9" r="2.7" fill={color} />
          <Path d="M15.4 14.4c2.9 0 5.1 1.9 5.1 5a.6.6 0 0 1-.6.6h-4.2z" fill={color} />
          <Circle cx="9" cy="8.4" r="3.5" fill={color} />
          <Path d="M9 14.2c3.3 0 6 2 6 5.4a.7.7 0 0 1-.7.7H3.7a.7.7 0 0 1-.7-.7c0-3.4 2.7-5.4 6-5.4z" fill={color} />
        </Svg>
      ) : (
        <Svg width={S} height={S} viewBox="0 0 24 24">
          <Circle cx="9" cy="8.4" r="3.4" {...stroke} />
          <Path d="M3.3 20c0-3.4 2.7-5.4 5.7-5.4s5.7 2 5.7 5.4" {...stroke} />
          <Path d="M15.6 5.5a2.7 2.7 0 0 1 0 5.2" {...stroke} />
          <Path d="M17.6 14.7c1.9.6 3.4 2 3.4 4.4v.9" {...stroke} />
        </Svg>
      );
    default:
      return null;
  }
}

/**
 * Comic-RPG bottom HUD (P2, Direction A): a floating dark-ink island with a
 * 52px center well the raised ember "+" sits in. The active tab reads as a
 * solid gold glyph, the rest as parchment-dim outlines. 4 tabs
 * (Today/Rewards/Board/Groups); Profile lives on the Ember header tile.
 * Passed to expo-router's Tabs via the `tabBar` render prop.
 */
export function BottomHUD({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const handler = useAddAction((s) => s.handler);
  const trigger = useAddAction((s) => s.trigger);

  const tabEls = TABS.map((tab) => {
    const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
    if (routeIndex === -1) return null;
    const route = state.routes[routeIndex];
    const isFocused = state.index === routeIndex;
    return (
      <Pressable
        key={route.key}
        style={styles.tab}
        onPress={() => {
          feedbackLight();
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        aria-label={tab.label}
      >
        <TabIcon name={tab.name} active={isFocused} />
        <Text style={[styles.label, { color: isFocused ? ACTIVE : INACTIVE }]}>{tab.label}</Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
      {handler && (
        <View style={styles.floatWrap} pointerEvents="box-none">
          <HardShadow style={styles.floatBtn} onPress={trigger} aria-label="Add">
            <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </HardShadow>
        </View>
      )}
      <View style={styles.bar}>
        {tabEls[0]}
        {tabEls[1]}
        <View style={styles.centerWell} />
        {tabEls[2]}
        {tabEls[3]}
      </View>
    </View>
  );
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  // The island floats with side + bottom margins over the parchment ground.
  wrap: { paddingHorizontal: 12, paddingTop: 4, backgroundColor: "transparent" },
  floatWrap: { position: "absolute", top: -20, left: 0, right: 0, alignItems: "center", zIndex: 2 },
  floatBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.color.ember,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    backgroundColor: INK,
    borderRadius: 16,
    paddingTop: 9,
    paddingBottom: 9,
    paddingHorizontal: 16,
  },
  tab: { width: 54, alignItems: "center", gap: 3 },
  centerWell: { width: 52 },
  label: { fontWeight: "700", fontSize: 9, fontFamily: fonts.display700 },
});
