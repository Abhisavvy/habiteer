import { FlexWidget, TextWidget, SvgWidget, OverlapWidget } from "react-native-android-widget";
import { theme } from "@/constants/theme";
import { widgetDark } from "./darkTheme";
import { FONT, widgetPalette } from "./palette";
import { WidgetCardFrame } from "./WidgetCardFrame";
import { emberSvg, expressionForStreak } from "./emberSvg";
import type { WidgetSnapshot } from "./snapshot";

/**
 * Home-screen widget (P2 "07 Widget suite · Companion 2×2") — Ember's
 * portrait, "LVL N", the current streak, and a "Day N! 🔥" speech-bubble
 * badge pinned to the top-left corner (the mock's own "living speech
 * bubble" bit — Ember says a fresh line each day, though this widget only
 * has the streak count to build one from, not a rotating line pool).
 * Ember's own SVG is genuinely square (its viewBox is 130×130) and so is
 * this widget's target size, so it's rendered live via `SvgWidget` rather
 * than pre-baked — the one widget in the suite where that's actually safe
 * (see emberSvg.ts). Ember's expression swaps by streak tier
 * (`expressionForStreak`), the same idea the app's own empty-state/level-up
 * screens already use.
 */
export function CompanionWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const p = widgetPalette(dark);
  const hero = dark ? widgetDark.hero : theme.color.hero;

  return (
    <WidgetCardFrame dark={dark} contentPadding={6}>
      <OverlapWidget style={{ width: "match_parent", height: "match_parent" }}>
        <FlexWidget style={{ width: "match_parent", height: "match_parent", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <SvgWidget svg={emberSvg(expressionForStreak(snapshot.topStreak))} style={{ width: 60, height: 60 }} />
          <TextWidget
            text={`LVL ${snapshot.level}`}
            style={{
              fontSize: 15,
              fontFamily: FONT.heading,
              color: hero,
              letterSpacing: 0.3,
              marginTop: 1,
              textShadowColor: p.textShadow,
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 0,
            }}
          />
          <TextWidget
            text={`🔥 ${snapshot.topStreak} day${snapshot.topStreak === 1 ? "" : "s"}`}
            style={{ fontSize: 10, fontFamily: FONT.mono, fontWeight: "bold", color: p.ember, marginTop: 1 }}
          />
        </FlexWidget>
        <FlexWidget
          style={{
            backgroundColor: p.gold,
            borderWidth: 3,
            borderColor: p.border,
            borderRadius: 10,
            paddingHorizontal: 7,
            paddingVertical: 2,
          }}
        >
          <TextWidget
            text={`Day ${snapshot.topStreak}! 🔥`}
            style={{ fontSize: 9, fontFamily: FONT.body, fontWeight: "bold", color: p.border }}
          />
        </FlexWidget>
      </OverlapWidget>
    </WidgetCardFrame>
  );
}
