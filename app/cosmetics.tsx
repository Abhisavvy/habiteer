import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Lock, Check } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { EquipPop } from "@/components/EquipPop";
import { Halftone } from "@/components/Halftone";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useProfileQuery, useTitleGrantsQuery, useEquipCosmetic } from "@/features/profile/useProfile";
import { useCompletionsQuery } from "@/features/completions/useCompletions";
import { overallProgress } from "@/features/completions/derived";
import { AVATAR_COLORS, TITLES, CARD_SKINS } from "@/features/cosmetics/catalog";

export default function Cosmetics() {
  const { data: profile } = useProfileQuery();
  const { data: titleGrants } = useTitleGrantsQuery();
  const { data: completions, isLoading } = useCompletionsQuery();
  const equipMutation = useEquipCosmetic();
  const grants = titleGrants ?? [];

  const level = overallProgress(completions ?? []).level;
  const equippedColor = profile?.avatarColor ?? "violet";
  const equippedTitle = profile?.titleId ?? "novice";
  const equippedSkin = profile?.cardSkin ?? "plain";

  const equip = (kind: "avatarColor" | "title" | "cardSkin", id: string) => {
    equipMutation.mutate({ kind, id }, { onError: (e: Error) => Alert.alert("Locked", e.message) });
  };

  return (
    <View style={styles.root}>
      <Halftone color={theme.color.ink} opacity={0.1} id="cosmetics-bg" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <HardShadow style={styles.backBtn} onPress={() => router.back()} aria-label="Back">
            <ArrowLeft size={18} strokeWidth={2.5} color={theme.color.ink} />
          </HardShadow>
          <Text style={styles.title}>COSMETICS</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <>
            <Text style={styles.sectionLabel}>Avatar color</Text>
            <View style={styles.swatchGrid}>
              {AVATAR_COLORS.map((c) => {
                const locked = level < c.level;
                const equipped = equippedColor === c.id;
                return (
                  <EquipPop key={c.id} equipped={equipped}>
                    <HardShadow
                      style={[styles.swatch, { backgroundColor: c.hex }, equipped && styles.swatchEquipped]}
                      onPress={locked ? undefined : () => equip("avatarColor", c.id)}
                      disabled={locked || equipMutation.isPending}
                    >
                      {locked ? (
                        <View style={styles.swatchOverlay}>
                          <Lock size={16} strokeWidth={2.5} color="#fff" />
                          <Text style={styles.swatchLockLabel}>LVL {c.level}</Text>
                        </View>
                      ) : equipped ? (
                        <Check size={20} strokeWidth={3} color={c.textColor} />
                      ) : null}
                    </HardShadow>
                  </EquipPop>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Title</Text>
            <View style={styles.titleList}>
              {TITLES.map((t) => {
                // An `earned` title's unlock level is an unreachable sentinel
                // (9999), so the level comparison would always read "locked"
                // and render "LVL 9999" — which looks like a bug rather than a
                // rule. Earned titles are gated on the grant row instead.
                const locked = t.earned ? !grants.includes(t.id) : level < t.level;
                const equipped = equippedTitle === t.id;
                return (
                  <EquipPop key={t.id} equipped={equipped}>
                    <HardShadow
                      style={[styles.titleRow, equipped && styles.titleRowEquipped]}
                      onPress={locked ? undefined : () => equip("title", t.id)}
                      disabled={locked || equipMutation.isPending}
                    >
                      <Text style={[styles.titleLabel, locked && styles.titleLabelLocked]}>{t.label}</Text>
                      {locked ? (
                        <View style={styles.titleLockBadge}>
                          <Lock size={12} strokeWidth={2.5} color={theme.color.ink} />
                          <Text style={styles.titleLockText}>{t.earned ? "KEEP A PLEDGE" : `LVL ${t.level}`}</Text>
                        </View>
                      ) : equipped ? (
                        <Text style={styles.titleEquippedText}>Equipped ✓</Text>
                      ) : (
                        <Text style={styles.titleEquipHint}>Tap to equip</Text>
                      )}
                    </HardShadow>
                  </EquipPop>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Card skin</Text>
            <View style={styles.swatchGrid}>
              {CARD_SKINS.map((s) => {
                const locked = level < s.level;
                const equipped = equippedSkin === s.id;
                return (
                  <EquipPop key={s.id} equipped={equipped}>
                    <HardShadow
                      style={[styles.skinSwatch, { backgroundColor: s.bg }, equipped && styles.swatchEquipped]}
                      onPress={locked ? undefined : () => equip("cardSkin", s.id)}
                      disabled={locked || equipMutation.isPending}
                    >
                      {locked ? (
                        <View style={styles.swatchOverlay}>
                          <Lock size={16} strokeWidth={2.5} color="#fff" />
                          <Text style={styles.swatchLockLabel}>LVL {s.level}</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.skinLabel}>{s.label}</Text>
                          {equipped && <Check size={16} strokeWidth={3} color={theme.color.ink} />}
                        </>
                      )}
                    </HardShadow>
                  </EquipPop>
                );
              })}
            </View>

            <Text style={styles.footnote}>Unlock more by leveling up. You're level {level}.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  scroll: { paddingHorizontal: 16, paddingTop: 54, paddingBottom: 40, gap: 15 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  title: { fontSize: 24, color: theme.color.ink, letterSpacing: 0.5, fontFamily: fonts.heading },
  sectionLabel: {
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(26,21,35,0.5)",
    fontFamily: fonts.mono700,
    marginTop: -2,
  },
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  swatch: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  swatchEquipped: { borderWidth: 5 },
  swatchOverlay: { alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: "rgba(26,21,35,0.45)", width: "100%", height: "100%" },
  swatchLockLabel: { fontWeight: "700", fontSize: 9, color: "#fff", fontFamily: fonts.mono700 },
  skinSwatch: {
    width: 96,
    height: 64,
    borderRadius: 14,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    overflow: "hidden",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  skinLabel: { fontWeight: "700", fontSize: 12, color: theme.color.ink, fontFamily: fonts.display700 },
  titleList: { gap: 10 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 15,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  titleRowEquipped: { backgroundColor: "#EDE7FF", borderColor: theme.color.hero },
  titleLabel: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  titleLabelLocked: { color: "rgba(26,21,35,0.4)" },
  titleLockBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  titleLockText: { fontWeight: "700", fontSize: 11, color: theme.color.ink, fontFamily: fonts.mono700 },
  titleEquippedText: { fontWeight: "700", fontSize: 12, color: theme.color.violet, fontFamily: fonts.mono700 },
  titleEquipHint: { fontWeight: "600", fontSize: 12, color: "rgba(26,21,35,0.45)", fontFamily: fonts.mono700 },
  footnote: { fontSize: 12, color: "rgba(26,21,35,0.55)", fontFamily: fonts.display600 },
});
