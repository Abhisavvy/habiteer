import { FlexWidget, TextWidget, ImageWidget, OverlapWidget } from "react-native-android-widget";
import { comboMultiplier } from "@/features/gamification/combo";
import { FONT, STARBURST_DARK, STARBURST_LIGHT, STARBURST_SIZE, widgetPalette } from "./palette";
import { WidgetCardFrame } from "./WidgetCardFrame";
import type { WidgetSnapshot } from "./snapshot";

/**
 * Home-screen widget (P2 "07 Widget suite · Combo 2×2") — new this round,
 * didn't exist before this pass. A starburst badge (pre-baked PNG, see
 * `scripts/gen-widget-starburst.js` — RemoteViews has no clip-path/polygon
 * support for the mock's star shape) with the current combo multiplier
 * overlaid on top. Reuses `comboMultiplier()`
 * (`gamification/combo.ts`) — the exact same function `TrackableCard`'s own
 * "×1.2" badge already calls — rather than re-deriving the tier math here.
 */
export function ComboWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const p = widgetPalette(dark);
  const combo = comboMultiplier(snapshot.topStreak);

  return (
    <WidgetCardFrame dark={dark} contentPadding={10}>
      <OverlapWidget style={{ width: "match_parent", height: "match_parent" }}>
        <FlexWidget style={{ width: "match_parent", height: "match_parent", alignItems: "center", justifyContent: "center" }}>
          <ImageWidget
            image={dark ? STARBURST_DARK : STARBURST_LIGHT}
            imageWidth={STARBURST_SIZE}
            imageHeight={STARBURST_SIZE}
            resizeMode="contain"
            style={{ width: 112, height: 112 }}
          />
        </FlexWidget>
        <FlexWidget style={{ width: "match_parent", height: "match_parent", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <TextWidget text="🔥" style={{ fontSize: 22 }} />
          <TextWidget text={`×${combo}`} style={{ fontSize: 22, fontFamily: FONT.heading, color: p.border, lineHeight: 22 }} />
          <TextWidget text="COMBO!" style={{ fontSize: 8, fontFamily: FONT.mono, fontWeight: "bold", color: p.border }} />
        </FlexWidget>
      </OverlapWidget>
    </WidgetCardFrame>
  );
}
