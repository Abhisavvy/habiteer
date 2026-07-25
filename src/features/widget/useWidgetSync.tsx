import { useEffect } from "react";
import { requestWidgetUpdate } from "react-native-android-widget";
import { useTrackablesQuery } from "@/features/trackables/useTrackables";
import { useCompletionsQuery, useCoinBalanceQuery } from "@/features/completions/useCompletions";
import { useProfileQuery } from "@/features/profile/useProfile";
import { useQuestClaimsQuery } from "@/features/quests/useQuests";
import { today } from "@/features/trackables/today";
import { buildWidgetSnapshot, capSnapshotRows, rowsForHeight, rowsForHeightExpanded, PERSIST_MAX_ROWS } from "./snapshot";
import { saveSnapshot } from "./storage";
import { HabitWidget } from "./HabitWidget";
import { TodayWidgetExpanded } from "./TodayWidgetExpanded";
import { CompanionWidget } from "./CompanionWidget";
import { StreakWidget } from "./StreakWidget";
import { ComboWidget } from "./ComboWidget";
import { QuestWidget } from "./QuestWidget";
import { WIDGET_NAMES } from "./taskHandler";

/** Called once near the app root — pushes a fresh snapshot to every widget
 * in the suite whenever the same live data every other screen already uses
 * changes. Every widget shares one `WidgetSnapshot`; each projects only the
 * pieces its own layout needs. */
export function useWidgetSync() {
  const { data: trackables } = useTrackablesQuery();
  const { data: completions } = useCompletionsQuery();
  const { data: coinBalance } = useCoinBalanceQuery();
  const { data: profile } = useProfileQuery();
  const { data: questClaims } = useQuestClaimsQuery();

  useEffect(() => {
    if (!trackables || !completions || coinBalance === undefined) return;

    const snapshot = buildWidgetSnapshot(
      trackables,
      completions,
      coinBalance,
      today(),
      PERSIST_MAX_ROWS,
      profile?.displayName ?? "",
      questClaims ?? []
    );
    saveSnapshot(snapshot);

    requestWidgetUpdate({
      widgetName: WIDGET_NAMES.TODAY,
      renderWidget: (info) => {
        const visible = capSnapshotRows(snapshot, rowsForHeight(info.height));
        return { light: <HabitWidget snapshot={visible} />, dark: <HabitWidget snapshot={visible} dark /> };
      },
    });

    requestWidgetUpdate({
      widgetName: WIDGET_NAMES.TODAY_EXPANDED,
      renderWidget: (info) => {
        const visible = capSnapshotRows(snapshot, rowsForHeightExpanded(info.height));
        return { light: <TodayWidgetExpanded snapshot={visible} />, dark: <TodayWidgetExpanded snapshot={visible} dark /> };
      },
    });

    requestWidgetUpdate({
      widgetName: WIDGET_NAMES.COMPANION,
      renderWidget: () => ({ light: <CompanionWidget snapshot={snapshot} />, dark: <CompanionWidget snapshot={snapshot} dark /> }),
    });

    requestWidgetUpdate({
      widgetName: WIDGET_NAMES.STREAK,
      renderWidget: () => ({ light: <StreakWidget snapshot={snapshot} />, dark: <StreakWidget snapshot={snapshot} dark /> }),
    });

    requestWidgetUpdate({
      widgetName: WIDGET_NAMES.COMBO,
      renderWidget: () => ({ light: <ComboWidget snapshot={snapshot} />, dark: <ComboWidget snapshot={snapshot} dark /> }),
    });

    requestWidgetUpdate({
      widgetName: WIDGET_NAMES.QUEST,
      renderWidget: () => ({ light: <QuestWidget snapshot={snapshot} />, dark: <QuestWidget snapshot={snapshot} dark /> }),
    });
  }, [trackables, completions, coinBalance, profile, questClaims]);
}
