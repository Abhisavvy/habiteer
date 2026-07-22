import { FlexWidget, TextWidget, OverlapWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget/lib/typescript/widgets/utils/style.props";
import { theme } from "@/constants/theme";
import { widgetDark } from "./darkTheme";
import type { WidgetSnapshot } from "./snapshot";

/** "9:30", no AM/PM — matches the reference mockup's clock card. */
function clockLabel(d: Date): string {
  const hour = d.getHours() % 12 || 12;
  return `${hour}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function palette(dark: boolean | undefined) {
  if (dark) {
    return {
      bg: widgetDark.bg,
      card: widgetDark.card,
      cardBorder: widgetDark.accentViolet as ColorProp,
      text: widgetDark.text,
      textFaded: widgetDark.textFaded as ColorProp,
      divider: "rgba(243, 240, 255, 0.14)" as ColorProp,
      checkboxBorder: widgetDark.accentViolet as ColorProp,
    };
  }
  return {
    bg: theme.color.paper,
    card: "#FFFFFF" as ColorProp,
    cardBorder: undefined as ColorProp | undefined,
    text: theme.color.ink,
    textFaded: "rgba(26, 21, 35, 0.45)" as ColorProp,
    divider: "rgba(26, 21, 35, 0.08)" as ColorProp,
    checkboxBorder: "rgba(26, 21, 35, 0.25)" as ColorProp,
  };
}

/** The widget's actual UI — built from the library's own primitives (RemoteViews-backed,
 * not regular React Native View/Text), so this approximates the app's look, not a 1:1 port.
 * `dark` picks the widget-only dark palette (`darkTheme.ts`); Android's RemoteViews
 * renderer swaps light/dark automatically per the system day/night setting.
 *
 * The clock reflects whenever this widget last rendered (app open, a habit tap, a resize,
 * or the OS's own refresh — capped at once per `updatePeriodMillis`, 30 min minimum by
 * Android policy), not a live tick — this library has no native clock view to fall back on. */
export function HabitWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const p = palette(dark);

  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, padding: 8, flexDirection: "column" }}
      clickAction="OPEN_APP"
    >
      <OverlapWidget>
        <FlexWidget style={{ width: "match_parent", backgroundColor: p.card, borderRadius: 18, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 32 }}>
          <TextWidget text={clockLabel(new Date())} style={{ fontSize: 28, fontWeight: "bold", color: p.text }} />
        </FlexWidget>

        <FlexWidget
          style={{
            width: "match_parent",
            marginTop: 26,
            backgroundColor: p.card,
            borderRadius: 18,
            padding: 12,
            flexDirection: "column",
            ...(p.cardBorder ? { borderWidth: 2, borderColor: p.cardBorder } : {}),
          }}
        >
          <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <FlexWidget style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: theme.color.jade, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
              <TextWidget text="✓" style={{ fontSize: 12, fontWeight: "bold", color: "#FFFFFF" }} />
            </FlexWidget>
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget text="Habiteer" style={{ fontSize: 14, fontWeight: "bold", color: p.text }} />
            </FlexWidget>
            <TextWidget text="🪙" style={{ fontSize: 12, marginRight: 3 }} />
            <TextWidget text={String(snapshot.coinBalance)} style={{ fontSize: 14, fontWeight: "bold", color: p.text }} />
          </FlexWidget>

          <FlexWidget style={{ width: "match_parent", height: 1, backgroundColor: p.divider, marginBottom: 2 }} />

          {snapshot.items.length === 0 && (
            <TextWidget text="All done for today 🎉" style={{ fontSize: 12, fontWeight: "600", color: p.text, paddingVertical: 8 }} />
          )}

          {snapshot.items.map((item, i) => (
            <FlexWidget key={item.id} style={{ width: "match_parent", flexDirection: "column" }}>
              <FlexWidget
                clickAction={item.isDone ? undefined : "COMPLETE_TRACKABLE"}
                clickActionData={item.isDone ? undefined : { id: item.id }}
                style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingVertical: 7 }}
              >
                <FlexWidget
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: item.isDone ? theme.color.jade : p.checkboxBorder,
                    backgroundColor: item.isDone ? theme.color.jade : p.card,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 7,
                  }}
                >
                  {item.isDone && <TextWidget text="✓" style={{ fontSize: 11, fontWeight: "bold", color: "#FFFFFF" }} />}
                </FlexWidget>
                <TextWidget text={item.emoji} style={{ fontSize: 13, marginRight: 6 }} />
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget
                    text={item.name}
                    truncate="END"
                    maxLines={1}
                    style={{ fontSize: 12, fontWeight: "700", color: item.isDone ? p.textFaded : p.text }}
                  />
                </FlexWidget>
                <TextWidget text={`+${item.payout}`} style={{ fontSize: 11, fontWeight: "600", color: p.textFaded }} />
              </FlexWidget>
              {i < snapshot.items.length - 1 && <FlexWidget style={{ width: "match_parent", height: 1, backgroundColor: p.divider }} />}
            </FlexWidget>
          ))}
        </FlexWidget>
      </OverlapWidget>

      {(snapshot.moreCount > 0 || snapshot.topStreak > 0) && (
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingHorizontal: 2 }}>
          <FlexWidget clickAction="OPEN_APP">
            {snapshot.moreCount > 0 && <TextWidget text={`+${snapshot.moreCount} more due today`} style={{ fontSize: 11, color: p.textFaded }} />}
          </FlexWidget>
          {snapshot.topStreak > 0 && (
            <TextWidget text={`🔥 ${snapshot.topStreak}`} style={{ fontSize: 12, fontWeight: "bold", color: theme.color.fire }} />
          )}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
