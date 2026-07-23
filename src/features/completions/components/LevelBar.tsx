import { View, Text, StyleSheet } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";

/** Comic-RPG level bar (P2): a hero-violet quest banner with a white halftone
 * "sun" wash, a Bangers LVL label in gold, and a gold XP fill. */
export function LevelBar({ level, intoLevel, need }: { level: number; intoLevel: number; need: number }) {
  const pct = Math.min(100, need > 0 ? (intoLevel / need) * 100 : 100);
  return (
    <HardShadow style={styles.card}>
      <Halftone color="#FFFFFF" opacity={0.22} id="levelbar-sun" />
      <View style={styles.row}>
        <Text style={styles.level}>LVL {level}</Text>
        <Text style={styles.xp}>
          {intoLevel.toLocaleString()} / {need.toLocaleString()} XP
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }, pct >= 100 && styles.fillFull]} />
      </View>
    </HardShadow>
  );
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.hero,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    overflow: "hidden",
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  level: { fontSize: 17, color: theme.color.gold, fontFamily: fonts.heading, letterSpacing: 0.5 },
  xp: { fontWeight: "700", fontSize: 11, color: "rgba(255,255,255,0.85)", fontFamily: fonts.mono700 },
  track: {
    height: 14,
    backgroundColor: "rgba(36,27,51,0.35)",
    borderWidth: theme.borders.hairline,
    borderColor: INK,
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: theme.color.gold, borderRightWidth: 2, borderRightColor: INK },
  fillFull: { borderRightWidth: 0 },
});
