import { Tabs } from "expo-router";
import { Check, Gift, Trophy, Users } from "lucide-react-native";
import { theme } from "@/constants/theme";
import { useWidgetSync } from "@/features/widget/useWidgetSync";

export default function TabsLayout() {
  useWidgetSync();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.violet,
        tabBarInactiveTintColor: theme.color.ink,
        tabBarStyle: { backgroundColor: theme.color.card, borderTopColor: theme.color.ink },
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Today", tabBarIcon: ({ color, size }) => <Check size={size} strokeWidth={3} color={color} /> }}
      />
      <Tabs.Screen
        name="rewards"
        options={{ title: "Rewards", tabBarIcon: ({ color, size }) => <Gift size={size} strokeWidth={3} color={color} /> }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{ title: "Ranks", tabBarIcon: ({ color, size }) => <Trophy size={size} strokeWidth={3} color={color} /> }}
      />
      <Tabs.Screen
        name="groups"
        options={{ title: "Groups", tabBarIcon: ({ color, size }) => <Users size={size} strokeWidth={3} color={color} /> }}
      />
    </Tabs>
  );
}
