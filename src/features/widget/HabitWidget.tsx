import { FlexWidget, TextWidget } from "react-native-android-widget";
import { theme } from "@/constants/theme";
import type { WidgetSnapshot } from "./snapshot";

/** The widget's actual UI — built from the library's own primitives (RemoteViews-backed,
 * not regular React Native View/Text), so this approximates the app's look, not a 1:1 port. */
export function HabitWidget({ snapshot }: { snapshot: WidgetSnapshot }) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: theme.color.paper,
        borderRadius: theme.radius,
        borderWidth: theme.border,
        borderColor: theme.color.ink,
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
        <TextWidget text="HABITEER" style={{ fontSize: 13, fontWeight: "bold", color: theme.color.ink }} />
        <TextWidget
          text={`🪙 ${snapshot.coinBalance}`}
          style={{ fontSize: 12, fontWeight: "bold", color: theme.color.ink }}
        />
      </FlexWidget>

      {snapshot.items.length === 0 && (
        <TextWidget
          text="All done for today 🎉"
          style={{ fontSize: 12, fontWeight: "600", color: theme.color.ink }}
        />
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
            backgroundColor: item.isDone ? "#E4E0F7" : "#FFFFFF",
            borderRadius: 10,
            borderWidth: 2,
            borderColor: theme.color.ink,
            padding: 6,
            marginBottom: 5,
          }}
        >
          <TextWidget text={item.emoji} style={{ fontSize: 15, marginRight: 6 }} />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text={item.name}
              truncate="END"
              maxLines={1}
              style={{ fontSize: 12, fontWeight: "600", color: theme.color.ink }}
            />
          </FlexWidget>
          {item.isDone && (
            <TextWidget text="✓" style={{ fontSize: 13, fontWeight: "bold", color: theme.color.jade }} />
          )}
        </FlexWidget>
      ))}

      {snapshot.moreCount > 0 && (
        <FlexWidget clickAction="OPEN_APP" style={{ width: "match_parent", alignItems: "center", padding: 3 }}>
          <TextWidget text={`+${snapshot.moreCount} more — open app`} style={{ fontSize: 11, color: theme.color.ink }} />
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
