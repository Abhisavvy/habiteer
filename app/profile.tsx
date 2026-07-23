import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft } from "lucide-react-native";
import { HardShadow } from "@/components/HardShadow";
import { Halftone } from "@/components/Halftone";
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
import { avatarColorFor, titleFor } from "@/features/cosmetics/catalog";
import { setFeedbackSetting } from "@/features/feedback/feedback";
import {
  remindersEnabled,
  setRemindersEnabled,
  requestReminderPermission,
  disableReminders,
  syncReminders,
} from "@/features/reminders/scheduler";

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
  const [remindersOn, setRemindersOn] = useState(true);

  useEffect(() => {
    void remindersEnabled().then(setRemindersOn);
  }, []);

  // Keep the feedback module's synchronous cache in step with the toggles.
  const onToggleSound = () => {
    setFeedbackSetting("sound", !soundOn);
    toggleSound();
  };
  const onToggleHaptics = () => {
    setFeedbackSetting("haptics", !hapticsOn);
    toggleHaptics();
  };

  // Master reminders switch: persist, then (on) request permission + reschedule
  // from the current trackables, or (off) cancel everything.
  const onToggleReminders = async () => {
    const next = !remindersOn;
    setRemindersOn(next);
    await setRemindersEnabled(next);
    if (next) {
      await requestReminderPermission();
      await syncReminders(trackables ?? []);
    } else {
      await disableReminders();
    }
  };

  const fallbackName = email ? email.split("@")[0] : "You";
  const displayName = profile?.displayName ?? fallbackName;
  const initial = displayName.charAt(0).toUpperCase();
  const avatarColor = avatarColorFor(profile?.avatarColor);
  const equippedTitle = titleFor(profile?.titleId);

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
      <Halftone color={theme.color.ink} opacity={0.1} id="profile-bg" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <HardShadow style={styles.backBtn} onPress={() => router.back()} aria-label="Back">
          <ArrowLeft size={18} strokeWidth={2.5} color={theme.color.ink} />
        </HardShadow>

        {/* Identity — centered avatar tile + name + level/title pill (mock 04) */}
        <View style={styles.identity}>
          <HardShadow style={[styles.avatar, { backgroundColor: avatarColor.hex }]}>
            <Text style={[styles.avatarText, { color: avatarColor.textColor }]}>{initial}</Text>
          </HardShadow>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
              onSubmitEditing={saveName}
              onBlur={saveName}
              returnKeyType="done"
              placeholder="Your name"
              placeholderTextColor="rgba(36,27,51,0.4)"
            />
          ) : (
            <Pressable style={styles.nameRow} onPress={startEditing} aria-label="Edit name">
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.editPencil}>✏️</Text>
            </Pressable>
          )}
          <View style={styles.lvlPill}>
            <Text style={styles.lvlPillText}>
              LVL {progress.level} · {equippedTitle?.label ?? "Habit Novice"}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.statsGrid}>
            <HardShadow style={styles.statCell}>
              <Text style={[styles.statValue, { color: theme.color.ember }]}>🔥 {longestStreak}</Text>
              <Text style={styles.statLabel}>Longest streak</Text>
            </HardShadow>
            <HardShadow style={styles.statCell}>
              <Text style={[styles.statValue, { color: theme.color.success }]}>{allCompletions.length}</Text>
              <Text style={styles.statLabel}>Habits done</Text>
            </HardShadow>
            <HardShadow style={styles.statCell}>
              <Text style={[styles.statValue, { color: theme.color.hero }]}>🪙 {coinBalance ?? 0}</Text>
              <Text style={styles.statLabel}>Coins</Text>
            </HardShadow>
            <HardShadow style={styles.statCell} onPress={() => setFreezeExplainer(true)}>
              <Text style={[styles.statValue, { color: theme.color.info }]}>❄️ {freezeBalance ?? 0}</Text>
              <Text style={styles.statLabel}>Freeze tokens</Text>
            </HardShadow>
          </View>
        )}

        <HardShadow style={styles.linkRow} onPress={() => router.push("/stats")}>
          <Text style={styles.linkText}>📊 See full stats</Text>
          <Text style={styles.linkArrow}>›</Text>
        </HardShadow>
        <HardShadow style={styles.linkRow} onPress={() => router.push("/cosmetics")}>
          <Text style={styles.linkText}>🎨 Cosmetics</Text>
          <Text style={styles.linkArrow}>›</Text>
        </HardShadow>

        <HardShadow style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>🔊 Sound</Text>
            <ToggleSwitch on={soundOn} onPress={onToggleSound} />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>📳 Haptics</Text>
            <ToggleSwitch on={hapticsOn} onPress={onToggleHaptics} />
          </View>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>🔔 Reminders</Text>
              <Text style={styles.settingHint}>Set a time per habit when adding or editing it</Text>
            </View>
            <ToggleSwitch on={remindersOn} onPress={onToggleReminders} />
          </View>
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <Text style={[styles.settingLabel, styles.settingLabelMuted]}>🌙 Dark mode</Text>
            <Text style={styles.soonBadge}>SOON</Text>
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
      style={[styles.toggleTrack, { backgroundColor: on ? theme.color.success : theme.color.paper }]}
      onPress={disabled ? undefined : onPress}
    >
      <View style={[styles.toggleKnob, on ? { right: 1 } : { left: 1 }]} />
    </Pressable>
  );
}

const INK = theme.color.ink;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper },
  scroll: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 40, gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    backgroundColor: theme.color.surface,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    shadowColor: INK,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  identity: { alignItems: "center", gap: 6, paddingTop: 4 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 22,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: INK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  avatarText: { fontWeight: "800", fontSize: 38, fontFamily: fonts.display700 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  name: { fontSize: 26, color: INK, fontFamily: fonts.heading, letterSpacing: 0.5 },
  editPencil: { fontSize: 14 },
  nameInput: {
    fontSize: 22,
    color: INK,
    fontFamily: fonts.display700,
    fontWeight: "800",
    borderBottomWidth: 2,
    borderBottomColor: theme.color.hero,
    paddingVertical: 0,
    minWidth: 140,
    textAlign: "center",
  },
  lvlPill: {
    backgroundColor: theme.color.hero,
    borderWidth: theme.borders.hairline,
    borderColor: INK,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  lvlPillText: { fontWeight: "700", fontSize: 11, color: "#fff", fontFamily: fonts.mono700 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 4 },
  statCell: {
    width: "47.8%",
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    padding: 11,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  statValue: { fontWeight: "700", fontSize: 22, fontFamily: fonts.mono700 },
  statLabel: { fontWeight: "700", fontSize: 10, color: "rgba(36,27,51,0.6)", fontFamily: fonts.display700, marginTop: 2 },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 14,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  linkText: { flex: 1, fontWeight: "700", fontSize: 14, color: INK, fontFamily: fonts.display700 },
  linkArrow: { fontWeight: "700", fontSize: 18, color: theme.color.hero },

  settingsCard: {
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: INK,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    shadowColor: INK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(36,27,51,0.1)",
  },
  settingRowLast: { borderBottomWidth: 0 },
  settingLabel: { flex: 1, fontWeight: "700", fontSize: 13, color: INK, fontFamily: fonts.display700 },
  settingLabelMuted: { color: "rgba(36,27,51,0.5)" },
  settingHint: { fontSize: 11, color: "rgba(36,27,51,0.5)", fontFamily: fonts.display600, marginTop: 1 },
  soonBadge: {
    fontWeight: "700",
    fontSize: 9,
    fontFamily: fonts.display700,
    color: INK,
    backgroundColor: theme.color.gold,
    borderWidth: 2,
    borderColor: INK,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: "hidden",
  },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 999,
    borderWidth: theme.borders.standard,
    borderColor: INK,
  },
  toggleKnob: {
    position: "absolute",
    top: 1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: INK,
  },
  signOutBtn: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.surface,
    borderWidth: theme.borders.standard,
    borderColor: theme.color.danger,
    borderRadius: 12,
    shadowColor: theme.color.danger,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  signOutText: { fontWeight: "700", fontSize: 14, color: theme.color.danger, fontFamily: fonts.display700 },
});
