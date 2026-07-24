import { FlexWidget, TextWidget, ImageWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget/lib/typescript/widgets/utils/style.props";
import type { ImageWidgetSource } from "react-native-android-widget/lib/typescript/widgets/ImageWidget";
import { theme } from "@/constants/theme";
import { widgetDark } from "./darkTheme";
import type { WidgetSnapshot } from "./snapshot";

function palette(dark: boolean | undefined) {
  if (dark) {
    return {
      card: widgetDark.card,
      border: widgetDark.border as ColorProp,
      text: widgetDark.text,
      textFaded: widgetDark.textFaded as ColorProp,
      divider: "rgba(243, 240, 255, 0.16)" as ColorProp,
      checkbox: widgetDark.track,
      checkboxBorder: widgetDark.border as ColorProp,
    };
  }
  return {
    card: theme.color.paper,
    border: theme.color.ink as ColorProp,
    text: theme.color.ink,
    textFaded: "rgba(36, 27, 51, 0.5)" as ColorProp,
    divider: "rgba(36, 27, 51, 0.15)" as ColorProp,
    checkbox: "#FFFFFF" as ColorProp,
    checkboxBorder: theme.color.ink as ColorProp,
  };
}

// Scheme-less resource name (not require()) → resolves to a compiled
// res/drawable via BitmapFactory.decodeResource, a fast synchronous local
// decode. require() resolves to a Metro http URL fetched on every render,
// which crashed intermittently (0x0 ImageView measure on a failed fetch).
// Copied into res/drawable/ each prebuild by withWidgetIconResource (app.config.ts).
const WIDGET_ICON = "widget_icon" as unknown as ImageWidgetSource;

/**
 * Home-screen widget (P2 "07 Widget suite · Today 4×2"). RemoteViews reality:
 * flat fills + text + pre-baked images only — no custom fonts (so the "TODAY"
 * header falls back to the system font, not Bangers), no shadows (definition
 * comes from the 3px border), no gradients, no text-decoration (a done row
 * fades its colour instead of striking through). Interactivity is crisp state
 * swaps: tapping an undone row fires COMPLETE_TRACKABLE and the widget
 * re-renders; the header/background deep-links to Today.
 *
 * `dark` picks the widget-only dark palette (`darkTheme.ts`); Android's
 * RemoteViews renderer swaps light/dark per the system day/night setting.
 */
export function HabitWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const p = palette(dark);

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: p.card,
        borderRadius: 16,
        borderWidth: theme.border,
        borderColor: p.border,
        padding: 12,
        flexDirection: "column",
      }}
      clickAction="OPEN_APP"
    >
      {/* Header: app-icon tile · TODAY N/M · streak · coins */}
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
        <FlexWidget
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: p.border,
            backgroundColor: p.card,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
          }}
        >
          <ImageWidget image={WIDGET_ICON} imageWidth={24} imageHeight={24} radius={6} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={`TODAY · ${snapshot.doneToday}/${snapshot.totalDue}`}
            style={{ fontSize: 15, fontWeight: "bold", color: p.text }}
          />
        </FlexWidget>
        {snapshot.topStreak > 0 && (
          <TextWidget
            text={`🔥${snapshot.topStreak}`}
            style={{ fontSize: 12, fontWeight: "bold", color: theme.color.ember, marginRight: 8 }}
          />
        )}
        <TextWidget text={`🪙${snapshot.coinBalance}`} style={{ fontSize: 12, fontWeight: "bold", color: p.text }} />
      </FlexWidget>

      <FlexWidget style={{ width: "match_parent", height: 2, backgroundColor: p.divider, marginTop: 8, marginBottom: 9 }} />

      {snapshot.items.length === 0 ? (
        <FlexWidget style={{ width: "match_parent", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <TextWidget text="🎉" style={{ fontSize: 26 }} />
          <TextWidget text="Nothing due today" style={{ fontSize: 13, fontWeight: "600", color: p.text, marginTop: 2 }} />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          {snapshot.items.map((item) => (
            <FlexWidget
              key={item.id}
              clickAction={item.isDone ? undefined : "COMPLETE_TRACKABLE"}
              clickActionData={item.isDone ? undefined : { id: item.id }}
              style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingVertical: 5 }}
            >
              <FlexWidget
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: p.checkboxBorder,
                  backgroundColor: item.isDone ? theme.color.success : p.checkbox,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 9,
                }}
              >
                {item.isDone && <TextWidget text="✓" style={{ fontSize: 12, fontWeight: "bold", color: "#FFFFFF" }} />}
              </FlexWidget>
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={item.name}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: 13, fontWeight: "600", color: item.isDone ? p.textFaded : p.text }}
                />
              </FlexWidget>
            </FlexWidget>
          ))}

          {snapshot.moreCount > 0 && (
            <TextWidget text={`+${snapshot.moreCount} more`} style={{ fontSize: 11, fontWeight: "600", color: p.textFaded, marginTop: 4 }} />
          )}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
