import { FlexWidget, TextWidget } from "react-native-android-widget";
import { FONT, widgetPalette } from "./palette";
import { WidgetCardFrame } from "./WidgetCardFrame";
import type { WidgetSnapshot } from "./snapshot";

/**
 * Home-screen widget (P2 "07 Widget suite · Quest 4×2") — new this round,
 * didn't exist before this pass. The mock shows a generic "Complete 3
 * habits" example; there's no daily-quest concept anywhere in this app's
 * data model, and inventing one (a specific quest-of-the-day selection, a
 * real coin bonus RPC) would be a new economy feature, out of scope for a
 * widget-visual fix. This is the honest, zero-new-backend version: "quest"
 * is just today's real due-count (`doneToday`/`totalDue`, already on
 * `WidgetSnapshot`), and the reward tag is the sum of not-yet-earned
 * payouts among today's remaining items — pure arithmetic over `items`
 * already in the snapshot, not a fabricated flat bonus.
 */
export function QuestWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const p = widgetPalette(dark);
  const { doneToday, totalDue, items } = snapshot;
  const pct = totalDue > 0 ? Math.min(100, (doneToday / totalDue) * 100) : 100;
  const remaining = items.filter((i) => !i.isDone).reduce((sum, i) => sum + i.payout, 0);

  return (
    <WidgetCardFrame dark={dark} contentPadding={12}>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", marginBottom: 9 }}>
        <TextWidget text="🎯" style={{ fontSize: 16, marginRight: 7 }} />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text="QUEST OF THE DAY" style={{ fontSize: 16, fontFamily: FONT.heading, color: p.text }} />
        </FlexWidget>
      </FlexWidget>

      {totalDue === 0 ? (
        <FlexWidget style={{ width: "match_parent", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <TextWidget text="🎉" style={{ fontSize: 22 }} />
          <TextWidget text="All done for today!" style={{ fontSize: 13, fontFamily: FONT.body, fontWeight: "bold", color: p.text, marginTop: 2 }} />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          <TextWidget
            text={`Complete ${totalDue} habit${totalDue === 1 ? "" : "s"}`}
            style={{ fontSize: 13, fontFamily: FONT.body, fontWeight: "bold", color: p.text, marginBottom: 7 }}
          />
          <FlexWidget
            style={{
              width: "match_parent",
              height: 14,
              flexDirection: "row",
              backgroundColor: "#FFFFFF",
              borderWidth: 2,
              borderColor: p.border,
              borderRadius: 999,
              marginBottom: 9,
            }}
          >
            <FlexWidget style={{ flex: Math.max(6, pct), height: "match_parent", backgroundColor: p.success, borderRadius: 999 }} />
            <FlexWidget style={{ flex: Math.max(0, 100 - pct) }} />
          </FlexWidget>
          <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget
                text={`${doneToday} / ${totalDue} done`}
                style={{ fontSize: 11, fontFamily: FONT.mono, fontWeight: "bold", color: p.textFaded }}
              />
            </FlexWidget>
            <FlexWidget
              style={{
                backgroundColor: p.gold,
                borderWidth: 3,
                borderColor: p.border,
                borderRadius: 9,
                paddingHorizontal: 10,
                paddingVertical: 4,
                rotation: -3,
              }}
            >
              <TextWidget text={`POW! 🪙${remaining}`} style={{ fontSize: 13, fontFamily: FONT.heading, color: p.border }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
      )}
    </WidgetCardFrame>
  );
}
