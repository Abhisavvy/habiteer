import { useEffect } from "react";
import { requestWidgetUpdate } from "react-native-android-widget";
import { useTrackablesQuery } from "@/features/trackables/useTrackables";
import { useCompletionsQuery, useCoinBalanceQuery } from "@/features/completions/useCompletions";
import { today } from "@/features/trackables/today";
import { buildWidgetSnapshot, capSnapshotRows, rowsForHeight, PERSIST_MAX_ROWS } from "./snapshot";
import { saveSnapshot } from "./storage";
import { HabitWidget } from "./HabitWidget";
import { WIDGET_NAME } from "./taskHandler";

/** Called once near the app root — pushes a fresh widget snapshot whenever
 * the same live data every other screen already uses changes. */
export function useWidgetSync() {
  const { data: trackables } = useTrackablesQuery();
  const { data: completions } = useCompletionsQuery();
  const { data: coinBalance } = useCoinBalanceQuery();

  useEffect(() => {
    if (!trackables || !completions || coinBalance === undefined) return;

    const snapshot = buildWidgetSnapshot(trackables, completions, coinBalance, today(), PERSIST_MAX_ROWS);
    saveSnapshot(snapshot);

    requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: (info) => {
        const visible = capSnapshotRows(snapshot, rowsForHeight(info.height));
        return { light: <HabitWidget snapshot={visible} />, dark: <HabitWidget snapshot={visible} dark /> };
      },
    });
  }, [trackables, completions, coinBalance]);
}
