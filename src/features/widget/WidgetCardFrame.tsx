import type { ReactNode } from "react";
import { FlexWidget, ImageWidget, OverlapWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget/lib/typescript/widgets/utils/style.props";
import { theme } from "@/constants/theme";
import { CARD_RADIUS, HALFTONE_H, HALFTONE_W, SHADOW_DX, SHADOW_DY, widgetPalette } from "./palette";

/**
 * Shared comic-panel scaffold for every home-screen widget: a hard offset
 * shadow (an ink layer behind the card, HardShadow.tsx's own trick — see
 * palette.ts's SHADOW_DX/DY), then either the halftone-textured card fill
 * (pre-baked PNG, stretched to fill via ImageWidget's resizeMode="stretch")
 * or a plain `solidFill` color (the Streak widget's ember card has no
 * halftone in the mock), and a border-only frame on top so the native
 * radius is always exact regardless of the fill layer's own rounding.
 *
 * `header`, if given, renders full-bleed above `children` — no horizontal
 * padding, flush against the card's own top rounding. The mock's Today 4×2
 * and Daily strip 4×4 both have a solid-color banner header (ink / violet)
 * that spans the card's full width despite the body being padded; CSS does
 * this with a negative margin, which RemoteViews has no equivalent for.
 * Per-corner radius does exist here though (confirmed in the vendored
 * `BorderStyleProps` type — `borderTopLeftRadius`/`borderTopRightRadius`
 * alongside the usual single `borderRadius`), so the caller's own header
 * node sets `borderTopLeftRadius`/`borderTopRightRadius: CARD_RADIUS` (and
 * 0 on the bottom corners) itself — this frame just stacks it above the
 * flex:1 padded body, both still inside the same halftone/border card.
 *
 * `children` renders inside the padded content area, on top of both layers.
 * `contentPadding` defaults to 12 (the Today widgets' own value) — the two
 * square 2×2 widgets use a bit more for their more spacious, centered layout.
 */
export function WidgetCardFrame({
  dark,
  contentPadding = 12,
  solidFill,
  header,
  rootOpensApp = true,
  children,
}: {
  dark?: boolean;
  contentPadding?: number;
  /** Skip the halftone card fill and use this flat color instead (the
   * Streak widget's mock spec is a solid ember card, no dot texture). */
  solidFill?: ColorProp;
  /** Full-bleed banner above the padded body — see the frame's own doc
   * comment above. Fully self-styled by the caller (background, internal
   * padding, top-corner radius); omit for widgets with a plain header
   * that just sits inside the padded body like everything else (Quest,
   * Companion, Combo, Streak). */
  header?: ReactNode;
  /** Whether the whole card is one big OPEN_APP tap target. Default true
   * for the widgets with no per-element clicks (Companion/Combo/Streak/
   * Quest). The two checklist widgets pass `false` and instead put
   * OPEN_APP on their own header region, because this library renders all
   * click regions as a flat overlay stack with NO parent/child priority —
   * a full-bleed OPEN_APP on the root sorts first (its tree-id "0-0" is a
   * string-prefix of every row's id) and lands underneath every row's own
   * hitbox in one shared container, so the launcher resolves taps to it
   * instead of the row. Scoping OPEN_APP to a non-overlapping region is
   * the only structural fix; see PROGRESS.md for the native-source trace. */
  rootOpensApp?: boolean;
  children: ReactNode;
}) {
  const p = widgetPalette(dark);

  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", backgroundColor: p.shadow, borderRadius: CARD_RADIUS }}
      clickAction={rootOpensApp ? "OPEN_APP" : undefined}
    >
      <OverlapWidget style={{ width: "match_parent", height: "match_parent", marginRight: SHADOW_DX, marginBottom: SHADOW_DY }}>
        {solidFill ? (
          <FlexWidget style={{ width: "match_parent", height: "match_parent", backgroundColor: solidFill, borderRadius: CARD_RADIUS }} />
        ) : (
          <ImageWidget
            image={p.halftone}
            imageWidth={HALFTONE_W}
            imageHeight={HALFTONE_H}
            resizeMode="stretch"
            style={{ width: "match_parent", height: "match_parent" }}
          />
        )}

        <FlexWidget
          style={{ width: "match_parent", height: "match_parent", borderRadius: CARD_RADIUS, borderWidth: theme.border, borderColor: p.border }}
        />

        <FlexWidget style={{ width: "match_parent", height: "match_parent", flexDirection: "column" }}>
          {header}
          <FlexWidget style={{ width: "match_parent", flex: 1, padding: contentPadding, flexDirection: "column" }}>
            {children}
          </FlexWidget>
        </FlexWidget>
      </OverlapWidget>
    </FlexWidget>
  );
}
