import { FlexWidget, TextWidget, SvgWidget } from "react-native-android-widget";
import { theme } from "@/constants/theme";
import { widgetDark } from "./darkTheme";
import { CARD_RADIUS, FONT, widgetPalette } from "./palette";
import { WidgetCardFrame } from "./WidgetCardFrame";
import { emberSvg, expressionForStreak } from "./emberSvg";
import type { WidgetSnapshot } from "./snapshot";

/**
 * Home-screen widget (P2 "07 Widget suite · Today 4×2") — the compact
 * checklist: a full-bleed ink banner header (gold-bordered Ember icon tile
 * · Bangers "TODAY · N/M" in gold · white streak · gold coins), then
 * checkbox rows on the halftone body. A completed row's checkbox fills
 * green and gets a rotated "DONE!" stamp next to it — the mock's own
 * confirmed tap-zone behavior ("re-render with DONE! stamp"), not just a
 * plain checkmark.
 *
 * RemoteViews reality, stated rather than glossed over: no text-decoration
 * (a done row fades instead of striking through), no gradients. Tapping an
 * undone row fires COMPLETE_TRACKABLE and the widget re-renders; the card
 * deep-links to Today.
 */
export function HabitWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const p = widgetPalette(dark);
  const bannerBg = dark ? widgetDark.ink : theme.color.ink;

  return (
    <WidgetCardFrame
      dark={dark}
      contentPadding={12}
      rootOpensApp={false}
      header={
        <FlexWidget
          clickAction="OPEN_APP"
          style={{
            width: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: bannerBg,
            borderTopLeftRadius: CARD_RADIUS,
            borderTopRightRadius: CARD_RADIUS,
            paddingHorizontal: 12,
            paddingVertical: 9,
          }}
        >
          <FlexWidget
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              borderWidth: 2,
              borderColor: p.gold,
              backgroundColor: p.tile,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <SvgWidget svg={emberSvg(expressionForStreak(snapshot.topStreak))} style={{ width: 20, height: 20 }} />
          </FlexWidget>
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text={`TODAY · ${snapshot.doneToday}/${snapshot.totalDue}`}
              truncate="END"
              maxLines={1}
              style={{ fontSize: 16, fontFamily: FONT.heading, color: p.gold, letterSpacing: 0.3 }}
            />
          </FlexWidget>
          {snapshot.topStreak > 0 && (
            <TextWidget
              text={`🔥${snapshot.topStreak}`}
              style={{ fontSize: 12, fontFamily: FONT.mono, fontWeight: "bold", color: "#FFFFFF", marginRight: 8 }}
            />
          )}
          <TextWidget text={`🪙${snapshot.coinBalance}`} style={{ fontSize: 12, fontFamily: FONT.mono, fontWeight: "bold", color: p.gold }} />
        </FlexWidget>
      }
    >
      {snapshot.items.length === 0 ? (
        <FlexWidget style={{ width: "match_parent", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <TextWidget text="🎉" style={{ fontSize: 26 }} />
          <TextWidget
            text="Nothing due today"
            style={{ fontSize: 14, fontFamily: FONT.body, fontWeight: "bold", color: p.text, marginTop: 2 }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          {snapshot.items.map((item) => (
            <FlexWidget
              key={item.id}
              clickAction={item.isDone ? undefined : "COMPLETE_TRACKABLE"}
              clickActionData={item.isDone ? undefined : { id: item.id }}
              style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingVertical: 6 }}
            >
              <FlexWidget
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: p.border,
                  backgroundColor: item.isDone ? p.success : p.checkbox,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                }}
              >
                {item.isDone && <TextWidget text="✓" style={{ fontSize: 13, fontWeight: "bold", color: "#FFFFFF" }} />}
              </FlexWidget>
              <FlexWidget style={{ flex: 1 }}>
                <TextWidget
                  text={item.name}
                  truncate="END"
                  maxLines={1}
                  style={{ fontSize: 15, fontFamily: FONT.body, fontWeight: "bold", color: item.isDone ? p.textFaded : p.text }}
                />
              </FlexWidget>
              {item.isDone && (
                <TextWidget
                  text="DONE!"
                  style={{ fontSize: 11, fontFamily: FONT.heading, color: p.success, rotation: -6 }}
                />
              )}
            </FlexWidget>
          ))}

          {snapshot.moreCount > 0 && (
            <TextWidget
              text={`+${snapshot.moreCount} more`}
              style={{ fontSize: 11, fontFamily: FONT.mono, fontWeight: "bold", color: p.textFaded, marginTop: 4 }}
            />
          )}
        </FlexWidget>
      )}
    </WidgetCardFrame>
  );
}
