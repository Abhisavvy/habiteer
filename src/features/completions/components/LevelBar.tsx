import { View, Text, StyleSheet } from "react-native";
import { Zap } from "lucide-react-native";
import { theme } from "@/constants/theme";

export function LevelBar({ level, intoLevel, need }: { level: number; intoLevel: number; need: number }) {
  const pct = Math.min(100, need > 0 ? (intoLevel / need) * 100 : 100);
  return (
    <View style={styles.wrap}>
      <View style={styles.chip}>
        <Zap size={14} strokeWidth={3} color={theme.color.yellow} />
        <Text style={styles.chipText}>LVL {level}</Text>
      </View>
      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.label}>
          {intoLevel} / {need} XP to level {level + 1}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: { color: theme.color.yellow, fontWeight: "800", fontSize: 12 },
  trackWrap: { flex: 1 },
  track: {
    height: 14,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.color.violet },
  label: { fontSize: 10, fontWeight: "700", color: theme.color.ink, marginTop: 3 },
});
