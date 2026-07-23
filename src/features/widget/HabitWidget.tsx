import { FlexWidget, TextWidget, ImageWidget, OverlapWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget/lib/typescript/widgets/utils/style.props";
import type { ImageWidgetSource } from "react-native-android-widget/lib/typescript/widgets/ImageWidget";
import { theme } from "@/constants/theme";
import { widgetDark } from "./darkTheme";
import type { WidgetSnapshot } from "./snapshot";

// How much of the clock card peeks out above the main card (OverlapWidget maps to
// Android's native FrameLayout, so children stack from (0,0) — the main card's
// marginTop below is what determines how much of the clock card underneath it stays
// visible). Kept as named constants, not magic numbers, because snapshot.ts's
// rowsForHeight FIXED_CHROME_DP has to add these up exactly — get them out of sync and
// rows silently clip off the bottom again, which is exactly the bug this caused before.
const CLOCK_CARD_HEIGHT_DP = 52; // paddingTop 8 + ~30dp text line height + paddingBottom 14
const CLOCK_PEEK_DP = 40; // main card's marginTop — how much of the clock card shows above it

/** "9:30", no AM/PM. */
function clockLabel(d: Date): string {
  const hour = d.getHours() % 12 || 12;
  return `${hour}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function palette(dark: boolean | undefined) {
  if (dark) {
    return {
      bg: widgetDark.bg,
      card: widgetDark.card,
      cardBorder: widgetDark.border as ColorProp,
      text: widgetDark.text,
      textFaded: widgetDark.textFaded as ColorProp,
      divider: "rgba(243, 240, 255, 0.14)" as ColorProp,
      checkboxBorder: widgetDark.accentViolet as ColorProp,
    };
  }
  return {
    bg: theme.color.paper,
    card: "#FFFFFF" as ColorProp,
    cardBorder: theme.color.ink as ColorProp,
    text: theme.color.ink,
    textFaded: "rgba(26, 21, 35, 0.45)" as ColorProp,
    divider: "rgba(26, 21, 35, 0.08)" as ColorProp,
    checkboxBorder: "rgba(26, 21, 35, 0.25)" as ColorProp,
  };
}

// Passed by plain resource name (no scheme), not require() — ResourceUtils.getBitmap
// (the library's native image loader) resolves a scheme-less string to a compiled
// android/app/src/main/res/drawable/ resource via BitmapFactory.decodeResource, a fast
// synchronous local decode. require() instead resolves to an http(s) URL and fetches it
// from Metro's dev server on every render, which crashed intermittently
// (`IllegalArgumentException: width and height must be > 0` — a transiently-failed
// fetch collapsed the native ImageView's measured size). The resource itself is copied
// into res/drawable/ on every prebuild by the withWidgetIconResource plugin in
// app.config.ts, since android/ is gitignored and regenerated, not hand-placed once.
const WIDGET_ICON = "widget_icon" as unknown as ImageWidgetSource;

/** The widget's actual UI — built from the library's own primitives (RemoteViews-backed,
 * not regular React Native View/Text), so this approximates the app's look, not a 1:1 port.
 * `dark` picks the widget-only dark palette (`darkTheme.ts`); Android's RemoteViews
 * renderer swaps light/dark automatically per the system day/night setting.
 *
 * Real hard shadows are unavailable too (see git blame / PROGRESS.md) — `CommonStyleProps`
 * has no shadow/elevation prop at all — so this leans on hard 3px borders (the app's own
 * neobrutalist convention) for definition instead.
 *
 * The clock reflects whenever this widget last rendered (app open, a habit tap, a resize,
 * or the OS's own refresh — capped at once per `updatePeriodMillis`, 30 min minimum by
 * Android policy), not a live tick — this library has no native clock view to fall back on.
 *
 * The clock card peeking out behind the main card is real z-stacking via `OverlapWidget`
 * (maps to Android's native FrameLayout), not a visual trick — it needs an explicit
 * `width` on the OverlapWidget itself, or its `wrap_content` default deadlocks against
 * its `match_parent` children and collapses to zero size (a real crash hit once before). */
export function HabitWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const p = palette(dark);

  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderRadius: theme.radius, padding: 6, flexDirection: "column" }}
      clickAction="OPEN_APP"
    >
      <OverlapWidget style={{ width: "match_parent" }}>
        <FlexWidget
          style={{
            width: "match_parent",
            height: CLOCK_CARD_HEIGHT_DP,
            backgroundColor: p.card,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingTop: 8,
          }}
        >
          <TextWidget text={clockLabel(new Date())} style={{ fontSize: 24, fontWeight: "bold", color: p.text }} />
        </FlexWidget>

        <FlexWidget
          style={{
            width: "match_parent",
            marginTop: CLOCK_PEEK_DP,
            backgroundColor: p.card,
            borderRadius: 16,
            padding: 8,
            flexDirection: "column",
            borderWidth: theme.border,
            borderColor: p.cardBorder,
          }}
        >
          <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
            <ImageWidget image={WIDGET_ICON} imageWidth={18} imageHeight={18} radius={5} style={{ marginRight: 6 }} />
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget text="Habiteer" style={{ fontSize: 12, fontWeight: "bold", color: p.text }} />
            </FlexWidget>
            <TextWidget text="🪙" style={{ fontSize: 11, marginRight: 3 }} />
            <TextWidget text={String(snapshot.coinBalance)} style={{ fontSize: 13, fontWeight: "bold", color: p.text }} />
          </FlexWidget>

          <FlexWidget style={{ width: "match_parent", height: 1, backgroundColor: p.divider, marginBottom: 1 }} />

          {snapshot.items.length === 0 && (
            <TextWidget text="All done for today 🎉" style={{ fontSize: 12, fontWeight: "600", color: p.text, paddingVertical: 6 }} />
          )}

          {snapshot.items.map((item, i) => (
            <FlexWidget key={item.id} style={{ width: "match_parent", flexDirection: "column" }}>
              <FlexWidget
                clickAction={item.isDone ? undefined : "COMPLETE_TRACKABLE"}
                clickActionData={item.isDone ? undefined : { id: item.id }}
                style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingVertical: 6 }}
              >
                <FlexWidget
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: item.isDone ? theme.color.jade : p.checkboxBorder,
                    backgroundColor: item.isDone ? theme.color.jade : p.card,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 6,
                  }}
                >
                  {item.isDone && <TextWidget text="✓" style={{ fontSize: 10, fontWeight: "bold", color: "#FFFFFF" }} />}
                </FlexWidget>
                <TextWidget text={item.emoji} style={{ fontSize: 12, marginRight: 5 }} />
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
