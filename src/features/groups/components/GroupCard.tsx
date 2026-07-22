import { View, Text, StyleSheet } from "react-native";
import { Users, ChevronRight } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import type { Group } from "../api";

export function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  return (
    <HardShadow style={styles.card} onPress={onPress}>
      <View style={styles.iconBox}>
        <Users size={20} strokeWidth={2.5} color={theme.color.violet} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.code}>Code · {group.inviteCode}</Text>
      </View>
      <ChevronRight size={18} strokeWidth={2.5} color={theme.color.ink} style={{ opacity: 0.4 }} />
    </HardShadow>
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
    padding: 13,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EDE7FF",
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontWeight: "700", fontSize: 16, color: theme.color.ink, fontFamily: fonts.display700 },
  code: { fontSize: 12, fontWeight: "700", color: "rgba(26,21,35,0.55)", marginTop: 2, fontFamily: fonts.mono700 },
});
