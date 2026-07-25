import { Tabs } from "expo-router";
import { BottomHUD } from "@/components/BottomHUD";
import { useWidgetSync } from "@/features/widget/useWidgetSync";

export default function TabsLayout() {
  useWidgetSync();

  return (
    <Tabs
      tabBar={(props) => <BottomHUD {...props} />}
      screenOptions={{
        headerShown: false,
        // Bottom-tabs' own default is an instant swap with no transition at
        // all; a deliberate cross-fade reads as "the app animates" instead.
        animation: "fade",
        transitionSpec: { animation: "timing", config: { duration: 250 } },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="rewards" options={{ title: "Rewards" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "Board" }} />
      <Tabs.Screen name="groups" options={{ title: "Groups" }} />
    </Tabs>
  );
}
