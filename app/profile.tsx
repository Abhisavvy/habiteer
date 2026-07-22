import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";
import { useAuth } from "@/features/auth/useAuth";
import { SignOutConfirmModal } from "@/features/auth/components/SignOutConfirmModal";
import { useProfileQuery, useUpdateDisplayName } from "@/features/profile/useProfile";
import { useBoolSetting } from "@/features/profile/useBoolSetting";
import { useTrackablesQuery } from "@/features/trackables/useTrackables";
import { today } from "@/features/trackables/today";
import { useCompletionsQuery, useCoinBalanceQuery, useFreezeBalanceQuery } from "@/features/completions/useCompletions";
import { overallProgress } from "@/features/completions/derived";
import { StreakFreezeExplainerModal } from "@/features/completions/components/StreakFreezeExplainerModal";
import { longestStreakEver } from "@/features/gamification/streak";

const STREAK_EXPLAINER_SEEN_KEY = "streakFreezeExplainerSeen";

export default function Profile() {
  const signOut = useAuth((s) => s.signOut);
  const email = useAuth((s) => s.session?.user.email);
  const { data: profile } = useProfileQuery();
  const updateNameMutation = useUpdateDisplayName();
  const { data: trackables } = useTrackablesQuery();
  const { data: completions, isLoading } = useCompletionsQuery();
  const { data: coinBalance } = useCoinBalanceQuery();
  const { data: freezeBalance } = useFreezeBalanceQuery();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [freezeExplainer, setFreezeExplainer] = useState(false);
  const [soundOn, toggleSound] = useBoolSetting("sound", true);
  const [hapticsOn, toggleHaptics] = useBoolSetting("haptics", true);

  const fallbackName = email ? email.split("@")[0] : "You";
  const displayName = profile?.displayName ?? fallbackName;
  const initial = displayName.charAt(0).toUpperCase();

  const allCompletions = completions ?? [];
  const progress = overallProgress(allCompletions);
  const todayStr = today();

  const byTrackable = new Map<string, string[]>();
  allCompletions.forEach((c) => {
    if (!byTrackable.has(c.trackableId)) byTrackable.set(c.trackableId, []);
    byTrackable.get(c.trackableId)!.push(c.completedOn);
  });
  let longestStreak = 0;
  (trackables ?? []).forEach((t) => {
    if (t.kind !== "habit") return;
    const dates = byTrackable.get(t.id);
    if (!dates || dates.length === 0) return;
    const s = longestStreakEver(dates, { weekdays: t.weekdays ?? undefined, period: t.period ?? undefined, quota: t.quota }, todayStr);
    if (s > longestStreak) longestStreak = s;
  });

  useEffect(() => {
    if (freezeBalance === undefined || freezeBalance <= 0) return;
    AsyncStorage.getItem(STREAK_EXPLAINER_SEEN_KEY).then((seen) => {
      if (!seen) {
        setFreezeExplainer(true);
        AsyncStorage.setItem(STREAK_EXPLAINER_SEEN_KEY, "1");
      }
    });
  }, [freezeBalance]);

  const startEditing = () => {
    setNameDraft(displayName);
    setEditing(true);
  };
  const saveName = () => {
    const trimmed = nameDraft.trim();
    setEditing(false);
    if (trimmed && trimmed !== displayName) updateNameMutation.mutate(trimmed);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <HardShadow style={styles.backBtn} onPress={() => router.back()} aria-label="Back">
              <ArrowLeft size={18} strokeWidth={2.5} color={theme.color.ink} />
            </HardShadow>
            <Text style={styles.title}>Profile</Text>
          </View>
          <HardShadow style={styles.editBtn} onPress={startEditing} aria-label="Edit name">
            <Text style={styles.editBtnText}>✎</Text>
          </HardShadow>
        </View>

        <HardShadow style={styles.card}>
          <HardShadow style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </HardShadow>
          <View style={styles.identity}>
            {editing ? (
              <TextInput
                style={styles.nameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                autoFocus
                onSubmitEditing={saveName}
                onBlur={saveName}
                returnKeyType="done"
              />
            ) : (
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
            )}
            <Text style={styles.handle}>@{fallbackName}</Text>
            <View style={styles.lvlChip}>
              <Text style={styles.lvlChipText}>LVL {progress.level}</Text>
            </View>
          </View>
        </HardShadow>

        <View style={styles.xpBlock}>
          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>
              LVL {progress.level} → {progress.level + 1}
            </Text>
            <Text style={styles.xpValue}>
              {progress.intoLevel.toLocaleString()} / {progress.need.toLocaleString()} XP
            </Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${Math.min(100, (progress.intoLevel / progress.need) * 100)}%` }]} />
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.statsGrid}>
            <HardShadow style={styles.statCell}>
              <Text style={styles.statValue}>{progress.totalXp.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Total XP</Text>
            </HardShadow>
            <HardShadow style={styles.statCell}>
              <Text style={[styles.statValue, { color: theme.color.fire }]}>{longestStreak} 🔥</Text>
              <Text style={styles.statLabel}>Longest streak</Text>
            </HardShadow>
            <HardShadow style={styles.statCell}>
              <Text style={[styles.statValue, { color: theme.color.jade }]}>{allCompletions.length}</Text>
              <Text style={styles.statLabel}>Habits done</Text>
            </HardShadow>
            <HardShadow style={styles.statCell}>
              <Text style={styles.statValue}>🪙 {coinBalance ?? 0}</Text>
              <Text style={styles.statLabel}>Coins</Text>
            </HardShadow>
          </View>
        )}

        <HardShadow style={styles.freezeRow} onPress={() => setFreezeExplainer(true)}>
          <Text style={styles.freezeEmoji}>❄️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.freezeTitle}>{freezeBalance ?? 0} freeze tokens</Text>
            <Text style={styles.freezeBody}>Auto-protects a streak on a missed day</Text>
          </View>
        </HardShadow>

        <Text style={styles.sectionLabel}>Settings</Text>
        <HardShadow style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>🔊</Text>
            <Text style={styles.settingLabel}>Sound effects</Text>
            <ToggleSwitch on={soundOn} onPress={toggleSound} />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>📳</Text>
            <Text style={styles.settingLabel}>Haptics</Text>
            <ToggleSwitch on={hapticsOn} onPress={toggleHaptics} />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingIcon}>🌙</Text>
            <Text style={styles.settingLabel}>
              Dark mode <Text style={styles.soonBadge}>SOON</Text>
            </Text>
            <ToggleSwitch on={false} onPress={() => {}} disabled />
          </View>
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <Text style={styles.settingIcon}>🔔</Text>
            <Text style={styles.settingLabel}>Reminders</Text>
            <Text style={styles.settingValue}>9:00 AM ›</Text>
          </View>
        </HardShadow>

        <HardShadow style={styles.signOutBtn} onPress={() => setSignOutConfirm(true)}>
          <Text style={styles.signOutText}>Sign out</Text>
        </HardShadow>
      </ScrollView>

      <SignOutConfirmModal visible={signOutConfirm} onCancel={() => setSignOutConfirm(false)} onConfirm={signOut} />
      <StreakFreezeExplainerModal
        visible={freezeExplainer}
        balance={freezeBalance ?? 0}
        onClose={() => setFreezeExplainer(false)}
      />
    </View>
  );
}

function ToggleSwitch({ on, onPress, disabled }: { on: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={[styles.toggleTrack, { backgroundColor: on ? theme.color.jade : theme.color.paper }]}
      onPress={disabled ? undefined : onPress}
    >
      <View style={[styles.toggleKnob, on ? { right: 1 } : { left: 1 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  scroll: { paddingHorizontal: 16, paddingTop: 54, paddingBottom: 40, gap: 15 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
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
  title: { fontWeight: "800", fontSize: 22, color: theme.color.ink, fontFamily: fonts.display700 },
  editBtn: {
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
  editBtnText: { fontSize: 15 },
  card: {
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: theme.radius,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 16,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    backgroundColor: theme.color.violet,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  avatarText: { fontWeight: "800", fontSize: 30, color: "#fff", fontFamily: fonts.display700 },
  identity: { flex: 1, minWidth: 0 },
  name: { fontWeight: "800", fontSize: 22, color: theme.color.ink, fontFamily: fonts.display700 },
  nameInput: {
    fontWeight: "800",
    fontSize: 22,
    color: theme.color.ink,
    fontFamily: fonts.display700,
    borderBottomWidth: 2,
    borderBottomColor: theme.color.violet,
    paddingVertical: 0,
  },
  handle: { fontWeight: "600", fontSize: 13, color: "rgba(26,21,35,0.55)", fontFamily: fonts.mono700, marginTop: 1 },
  lvlChip: {
    alignSelf: "flex-start",
    marginTop: 7,
    backgroundColor: theme.color.yellow,
    borderWidth: 2,
    borderColor: theme.color.ink,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lvlChipText: { fontWeight: "700", fontSize: 11, color: theme.color.ink, fontFamily: fonts.mono700 },
  xpBlock: { gap: 6 },
  xpRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  xpLabel: { fontWeight: "700", fontSize: 12, color: theme.color.violet, fontFamily: fonts.mono700 },
  xpValue: { fontSize: 11, color: "rgba(26,21,35,0.55)", fontFamily: fonts.mono700 },
  xpTrack: {
    height: 16,
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 999,
    overflow: "hidden",
  },
  xpFill: { height: "100%", backgroundColor: theme.color.violet, borderRightWidth: theme.border, borderRightColor: theme.color.ink },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  statCell: {
    width: "47.5%",
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 13,
    padding: 13,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  statValue: { fontWeight: "700", fontSize: 22, color: theme.color.ink, fontFamily: fonts.mono700 },
  statLabel: { fontWeight: "600", fontSize: 11, color: "rgba(26,21,35,0.6)", fontFamily: fonts.display600, marginTop: 2 },
  freezeRow: {
    backgroundColor: "#EDE7FF",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  freezeEmoji: { fontSize: 26 },
  freezeTitle: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  freezeBody: { fontSize: 11, lineHeight: 15, color: "rgba(26,21,35,0.6)", marginTop: 1 },
  sectionLabel: {
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(26,21,35,0.5)",
    fontFamily: fonts.mono700,
    marginTop: -4,
  },
  settingsCard: {
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 13,
    overflow: "hidden",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(26,21,35,0.1)",
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingIcon: { fontSize: 18 },
  settingLabel: { flex: 1, fontWeight: "600", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display600 },
  settingValue: { fontWeight: "600", fontSize: 13, color: "rgba(26,21,35,0.5)", fontFamily: fonts.mono700 },
  soonBadge: {
    fontWeight: "700",
    fontSize: 9,
    fontFamily: fonts.mono700,
    backgroundColor: theme.color.yellow,
    borderWidth: 1.5,
    borderColor: theme.color.ink,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 4,
  },
  toggleTrack: {
    width: 46,
    height: 26,
    borderRadius: 999,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
  },
  toggleKnob: {
    position: "absolute",
    top: 1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: theme.color.ink,
  },
  signOutBtn: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  signOutText: { fontWeight: "700", fontSize: 15, color: theme.color.fire, fontFamily: fonts.display700 },
});
