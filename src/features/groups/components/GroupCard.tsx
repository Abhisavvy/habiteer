import { View, Text, StyleSheet } from "react-native";
import { Users } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import type { Group } from "../api";

/**
 * Group list card (P2 "04 Groups" mock shape). The mock shows a per-group emoji
 * tile + "🔥14 · 3 members"; the list query only carries {name, inviteCode}
 * today (streak/member-count live on GroupDetail), so the subtitle shows the
 * invite code — extending the list query is a separate follow-up.
 */
export function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  return (
    <HardShadow style={styles.card} onPress={onPress}>
      <View style={styles.iconBox}>
        <Users size={22} strokeWidth={2.6} color="#fff" />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.code}>Code · {group.inviteCode}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </HardShadow>
  );
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 14,
    padding: 12,
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  iconBox: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.ember,
  },
  body: { flex: 1, minWidth: 0 },
  name: { fontWeight: "700", fontSize: 15, color: INK, fontFamily: fonts.display700 },
  code: { fontSize: 11, fontWeight: "700", color: theme.color.ember, marginTop: 2, fontFamily: fonts.mono700 },
  chevron: { fontSize: 18, fontWeight: "700", color: INK, fontFamily: fonts.display700 },
});
