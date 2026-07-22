import { View, Text, Pressable, StyleSheet } from "react-native";
import { Users, ChevronRight } from "lucide-react-native";
import { theme } from "@/constants/theme";
import type { Group } from "../api";

export function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.iconBox}>
        <Users size={20} strokeWidth={3} color={theme.color.ink} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.code}>Code · {group.inviteCode}</Text>
      </View>
      <ChevronRight size={18} strokeWidth={3} color={theme.color.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.color.card,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 12,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.violet,
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontWeight: "700", fontSize: 16, color: theme.color.ink },
  code: { fontSize: 12, fontWeight: "700", color: theme.color.ink, opacity: 0.6, marginTop: 2 },
});
