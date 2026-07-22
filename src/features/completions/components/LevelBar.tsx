import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";

export function LevelBar({ level, intoLevel, need }: { level: number; intoLevel: number; need: number }) {
  const pct = Math.min(100, need > 0 ? (intoLevel / need) * 100 : 100);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.level}>LVL {level}</Text>
        <Text style={styles.xp}>
          {intoLevel.toLocaleString()} / {need.toLocaleString()} XP
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }, pct >= 100 && styles.fillFull]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  level: { fontWeight: "700", fontSize: 13, color: theme.color.violet, fontFamily: fonts.mono700 },
  xp: { fontWeight: "400", fontSize: 11, color: "rgba(26,21,35,0.55)", fontFamily: fonts.mono700 },
  track: {
    height: 16,
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.color.violet, borderRightWidth: 3, borderRightColor: theme.color.ink },
  fillFull: { borderRightWidth: 0 },
});
