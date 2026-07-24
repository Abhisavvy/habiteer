import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { HabitWidget } from "./HabitWidget";
import { loadSnapshot, saveSnapshot } from "./storage";
import { capSnapshotRows, rowsForHeight, type WidgetSnapshot } from "./snapshot";
import { completeTrackable } from "@/features/completions/api";

export const WIDGET_NAME = "HabitWidget";

const EMPTY_SNAPSHOT: WidgetSnapshot = { items: [], coinBalance: 0, topStreak: 0, moreCount: 0, doneToday: 0, totalDue: 0 };

/**
 * Runs in a headless JS context that can't assume the app's in-memory state
 * exists (e.g. after a phone reboot, before the app has opened this session)
 * — reads the last snapshot the live app persisted instead.
 */
export const widgetTaskHandler = async (props: WidgetTaskHandlerProps) => {
  if (props.widgetInfo.widgetName !== WIDGET_NAME) return;

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      const stored = (await loadSnapshot()) ?? EMPTY_SNAPSHOT;
      const visible = capSnapshotRows(stored, rowsForHeight(props.widgetInfo.height));
      props.renderWidget({ light: <HabitWidget snapshot={visible} />, dark: <HabitWidget snapshot={visible} dark /> });
      break;
    }

    case "WIDGET_CLICK": {
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
      const visible = capSnapshotRows(optimistic, rowsForHeight(props.widgetInfo.height));
      props.renderWidget({ light: <HabitWidget snapshot={visible} />, dark: <HabitWidget snapshot={visible} dark /> });

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
