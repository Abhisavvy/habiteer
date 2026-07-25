import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { HabitWidget } from "./HabitWidget";
import { TodayWidgetExpanded } from "./TodayWidgetExpanded";
import { CompanionWidget } from "./CompanionWidget";
import { StreakWidget } from "./StreakWidget";
import { ComboWidget } from "./ComboWidget";
import { QuestWidget } from "./QuestWidget";
import { loadSnapshot, saveSnapshot } from "./storage";
import { capSnapshotRows, rowsForHeight, rowsForHeightExpanded, type WidgetSnapshot } from "./snapshot";
import { completeTrackable } from "@/features/completions/api";

/** The suite (P2 "07 Widget suite"): the widget types the user picks from
 * when adding a Habiteer widget, all registered in app.config.ts and all
 * rendered from the same shared `WidgetSnapshot`. STREAK is off the current
 * mock (it dropped that widget in favor of COMBO/QUEST) but stays
 * registered — removing it would orphan any instance already placed on a
 * home screen, since there's no way to programmatically clean that up. */
export const WIDGET_NAMES = {
  TODAY: "HabitWidget",
  TODAY_EXPANDED: "TodayWidgetExpanded",
  COMPANION: "CompanionWidget",
  STREAK: "StreakWidget",
  COMBO: "ComboWidget",
  QUEST: "QuestWidget",
} as const;
type WidgetName = (typeof WIDGET_NAMES)[keyof typeof WIDGET_NAMES];

const EMPTY_SNAPSHOT: WidgetSnapshot = {
  items: [],
  coinBalance: 0,
  topStreak: 0,
  moreCount: 0,
  doneToday: 0,
  totalDue: 0,
  level: 1,
  intoLevel: 0,
  need: 1,
  displayName: "",
  featuredQuest: null,
};

/** Only the two Today variants are list-based and need row-capping to the
 * widget's actual current height; Companion/Streak show fixed content. */
function renderForWidget(name: string, snapshot: WidgetSnapshot, heightDp: number) {
  switch (name) {
    case WIDGET_NAMES.TODAY: {
      const visible = capSnapshotRows(snapshot, rowsForHeight(heightDp));
      return { light: <HabitWidget snapshot={visible} />, dark: <HabitWidget snapshot={visible} dark /> };
    }
    case WIDGET_NAMES.TODAY_EXPANDED: {
      const visible = capSnapshotRows(snapshot, rowsForHeightExpanded(heightDp));
      return { light: <TodayWidgetExpanded snapshot={visible} />, dark: <TodayWidgetExpanded snapshot={visible} dark /> };
    }
    case WIDGET_NAMES.COMPANION:
      return { light: <CompanionWidget snapshot={snapshot} />, dark: <CompanionWidget snapshot={snapshot} dark /> };
    case WIDGET_NAMES.STREAK:
      return { light: <StreakWidget snapshot={snapshot} />, dark: <StreakWidget snapshot={snapshot} dark /> };
    case WIDGET_NAMES.COMBO:
      return { light: <ComboWidget snapshot={snapshot} />, dark: <ComboWidget snapshot={snapshot} dark /> };
    case WIDGET_NAMES.QUEST:
      return { light: <QuestWidget snapshot={snapshot} />, dark: <QuestWidget snapshot={snapshot} dark /> };
    default:
      return null;
  }
}

const KNOWN_NAMES: readonly string[] = Object.values(WIDGET_NAMES);

/**
 * Runs in a headless JS context that can't assume the app's in-memory state
 * exists (e.g. after a phone reboot, before the app has opened this session)
 * — reads the last snapshot the live app persisted instead. One shared
 * snapshot backs every widget in the suite; each render function above only
 * projects the pieces its own layout needs.
 */
export const widgetTaskHandler = async (props: WidgetTaskHandlerProps) => {
  const name = props.widgetInfo.widgetName;
  if (!KNOWN_NAMES.includes(name)) return;

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      const stored = (await loadSnapshot()) ?? EMPTY_SNAPSHOT;
      const rendered = renderForWidget(name, stored, props.widgetInfo.height);
      if (rendered) props.renderWidget(rendered);
      break;
    }

    case "WIDGET_CLICK": {
      // Only the two Today variants have per-row click targets (see their
      // own clickAction wiring) — Companion/Streak/Combo/Quest only set the
      // root OPEN_APP, a "special value" the library handles natively
      // without ever invoking this handler, so this branch never fires
      // for them.
      const id = props.clickActionData?.id as string | undefined;
      if (!id) break;

      const stored = (await loadSnapshot()) ?? EMPTY_SNAPSHOT;

      // Optimistic: flip it locally and re-render immediately — the "one tap
      // from the home screen" this whole feature exists for.
      const optimistic: WidgetSnapshot = {
        ...stored,
        items: stored.items.map((item) => (item.id === id ? { ...item, isDone: true } : item)),
      };
      await saveSnapshot(optimistic);
      const rendered = renderForWidget(name, optimistic, props.widgetInfo.height);
      if (rendered) props.renderWidget(rendered);

      // Best-effort sync (confirmed with user): leave the optimistic state on
      // failure rather than a full retry queue — reconciles next time the
      // real app opens and refetches the true server state.
      try {
        await completeTrackable(id);
      } catch (err) {
        console.warn("[widget] completeTrackable failed, leaving optimistic state:", err);
      }
      break;
    }

    case "WIDGET_DELETED":
    default:
      break;
  }
};

export type { WidgetName };
