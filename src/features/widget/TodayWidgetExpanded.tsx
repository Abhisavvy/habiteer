import { FlexWidget, TextWidget, SvgWidget, ImageWidget, OverlapWidget } from "react-native-android-widget";
import { theme } from "@/constants/theme";
import { widgetDark } from "./darkTheme";
import { BANNER_DOTS, BANNER_DOTS_H, BANNER_DOTS_W, CARD_RADIUS, DAILY_STRIP_BANNER_HEIGHT, FONT, widgetPalette } from "./palette";
import { WidgetCardFrame } from "./WidgetCardFrame";
import { emberSvg, expressionForStreak } from "./emberSvg";
import type { WidgetSnapshot } from "./snapshot";

/**
 * Home-screen widget (P2 "07 Widget suite · Daily strip 4×4") — replaces
 * what this file used to render as "Today 4×4". A full-bleed violet header
 * banner (dot-textured, border-bottom in ink) holds the icon tile, "LVL N
 * · NAME" with an embedded progress bar, and the streak/coin readout —
 * then the checklist continues below on the usual halftone body, each row
 * showing its own coin payout (ember while pending, faded once done — no
 * "DONE!" stamp here, that's Today 4×2's own treatment, per the mock).
 *
 * The registered widget name stays `TodayWidgetExpanded` (app.config.ts) —
 * renaming it would orphan any instance already placed on a home screen,
 * the same reasoning that kept the old Streak widget's registration alive
 * even though it's off the current mock.
 */
export function TodayWidgetExpanded({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const p = widgetPalette(dark);
  const pct = Math.min(100, snapshot.need > 0 ? (snapshot.intoLevel / snapshot.need) * 100 : 100);
  const bannerBg = dark ? widgetDark.hero : theme.color.hero;
  const bannerBorder = dark ? widgetDark.ink : theme.color.ink;
  const nameSuffix = snapshot.displayName ? ` · ${snapshot.displayName.toUpperCase()}` : "";

  return (
    <WidgetCardFrame
      dark={dark}
      contentPadding={13}
      rootOpensApp={false}
      header={
        // Explicit height on the OverlapWidget and every layer inside it —
        // deliberately not relying on Android FrameLayout's wrap-content-
        // sized-to-tallest-child + match_parent-siblings two-pass measure
        // (which WOULD work, but isn't worth leaving unverified when a
        // fixed number removes the ambiguity entirely: 40dp icon tile + 12dp
        // padding top/bottom = 64dp). clickAction here (not on the card root)
        // is the banner's OPEN_APP tap zone — see WidgetCardFrame's
        // rootOpensApp doc for why a root-level OPEN_APP would swallow the
        // per-row COMPLETE_TRACKABLE taps.
        <OverlapWidget style={{ width: "match_parent", height: DAILY_STRIP_BANNER_HEIGHT }} clickAction="OPEN_APP">
          <FlexWidget
            style={{
              width: "match_parent",
              height: DAILY_STRIP_BANNER_HEIGHT,
              backgroundColor: bannerBg,
              borderTopLeftRadius: CARD_RADIUS,
              borderTopRightRadius: CARD_RADIUS,
              borderBottomWidth: 4,
              borderBottomColor: bannerBorder,
            }}
          />
          <ImageWidget
            image={BANNER_DOTS}
            imageWidth={BANNER_DOTS_W}
            imageHeight={BANNER_DOTS_H}
            resizeMode="stretch"
            style={{ width: "match_parent", height: DAILY_STRIP_BANNER_HEIGHT, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }}
          />
          <FlexWidget style={{ width: "match_parent", height: DAILY_STRIP_BANNER_HEIGHT, flexDirection: "row", alignItems: "center", padding: 12 }}>
            <FlexWidget
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: bannerBorder,
                backgroundColor: p.tile,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 10,
              }}
            >
              <SvgWidget svg={emberSvg(expressionForStreak(snapshot.topStreak))} style={{ width: 34, height: 34 }} />
            </FlexWidget>
            <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
              <TextWidget
                text={`LVL ${snapshot.level}${nameSuffix}`}
                truncate="END"
                maxLines={1}
                style={{ fontSize: 18, fontFamily: FONT.heading, color: "#FFFFFF" }}
              />
              <FlexWidget
                style={{
                  width: "match_parent",
                  height: 9,
                  flexDirection: "row",
                  backgroundColor: "rgba(0, 0, 0, 0.28)",
                  borderWidth: 2,
                  borderColor: bannerBorder,
                  borderRadius: 999,
                  marginTop: 4,
                }}
              >
                <FlexWidget style={{ flex: Math.max(4, pct), height: "match_parent", backgroundColor: p.gold, borderRadius: 999 }} />
                <FlexWidget style={{ flex: Math.max(0, 100 - pct) }} />
              </FlexWidget>
            </FlexWidget>
            <FlexWidget style={{ flexDirection: "column", alignItems: "flex-end" }}>
              <TextWidget text={`🔥${snapshot.topStreak}`} style={{ fontSize: 12, fontFamily: FONT.mono, fontWeight: "bold", color: "#FFFFFF" }} />
              <TextWidget
                text={`🪙${snapshot.coinBalance}`}
                style={{ fontSize: 12, fontFamily: FONT.mono, fontWeight: "bold", color: p.gold, marginTop: 2 }}
              />
            </FlexWidget>
          </FlexWidget>
        </OverlapWidget>
      }
    >
      {snapshot.items.length === 0 ? (
        <FlexWidget style={{ width: "match_parent", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <TextWidget text="🎉" style={{ fontSize: 28 }} />
          <TextWidget
            text="Nothing due today"
            style={{ fontSize: 15, fontFamily: FONT.body, fontWeight: "bold", color: p.text, marginTop: 2 }}
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
                  width: 24,
                  height: 24,
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
              <TextWidget
                text={`+${item.payout}`}
                style={{ fontSize: 11, fontFamily: FONT.mono, fontWeight: "bold", color: item.isDone ? p.textFaded : p.ember }}
              />
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
