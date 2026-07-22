import { FlexWidget, TextWidget } from "react-native-android-widget";
import { theme } from "@/constants/theme";
import { widgetDark } from "./darkTheme";
import type { WidgetSnapshot } from "./snapshot";

/** The widget's actual UI — built from the library's own primitives (RemoteViews-backed,
 * not regular React Native View/Text), so this approximates the app's look, not a 1:1 port.
 * `dark` picks the widget-only dark palette (`darkTheme.ts`); Android's RemoteViews
 * renderer swaps light/dark automatically per the system day/night setting. */
export function HabitWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const bg = dark ? widgetDark.bg : theme.color.paper;
  const border = dark ? widgetDark.border : theme.color.ink;
  const text = dark ? widgetDark.text : theme.color.ink;
  const cardUndone = dark ? widgetDark.card : "#FFFFFF";
  const cardDone = dark ? widgetDark.doneCard : "#E4E0F7";

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: bg,
        borderRadius: theme.radius,
        borderWidth: theme.border,
        borderColor: border,
        padding: 10,
        flexDirection: "column",
      }}
      clickAction="OPEN_APP"
    >
      <FlexWidget
        style={{
          width: "match_parent",
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <TextWidget text="Habiteer" style={{ fontSize: 13, fontWeight: "bold", color: text }} />
        <TextWidget
          text={`🪙 ${snapshot.coinBalance}`}
          style={{ fontSize: 12, fontWeight: "bold", color: theme.color.ink }}
        />
      </FlexWidget>

      {snapshot.items.length === 0 && (
        <TextWidget text="All done for today 🎉" style={{ fontSize: 12, fontWeight: "600", color: text }} />
      )}

      {snapshot.items.map((item) => (
        <FlexWidget
          key={item.id}
          clickAction={item.isDone ? undefined : "COMPLETE_TRACKABLE"}
          clickActionData={item.isDone ? undefined : { id: item.id }}
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: item.isDone ? cardDone : cardUndone,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: border,
            padding: 6,
            marginBottom: 5,
          }}
        >
          <TextWidget text={item.emoji} style={{ fontSize: 15, marginRight: 6 }} />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={item.name} truncate="END" maxLines={1} style={{ fontSize: 12, fontWeight: "600", color: text }} />
          </FlexWidget>
          {item.isDone && (
            <TextWidget text="✓" style={{ fontSize: 13, fontWeight: "bold", color: theme.color.jade }} />
          )}
        </FlexWidget>
      ))}

      {snapshot.moreCount > 0 && (
        <FlexWidget clickAction="OPEN_APP" style={{ width: "match_parent", alignItems: "center", padding: 3 }}>
          <TextWidget text={`+${snapshot.moreCount} more — open app`} style={{ fontSize: 11, color: text }} />
        </FlexWidget>
      )}

      {snapshot.topStreak > 0 && (
        <TextWidget
          text={`🔥 ${snapshot.topStreak}`}
          style={{ fontSize: 11, fontWeight: "bold", color: theme.color.fire, marginTop: 4 }}
        />
      )}
    </FlexWidget>
  );
}
