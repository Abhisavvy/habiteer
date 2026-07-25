import type { ColorProp } from "react-native-android-widget/lib/typescript/widgets/utils/style.props";
import type { ImageWidgetSource } from "react-native-android-widget/lib/typescript/widgets/ImageWidget";
import { theme } from "@/constants/theme";
import { widgetDark } from "./darkTheme";

// Real fonts, loaded from android/app/src/main/assets/fonts/ (copied there on
// every prebuild by withWidgetAssets in app.config.ts) — a completely
// separate mechanism from expo-font's JS-only registry every other screen
// uses. Without this widget text silently falls back to the system font;
// with it, every widget genuinely carries the app's Bangers/Space Mono/
// Space Grotesk voice, not an approximation of it.
export const FONT = { heading: "Bangers", mono: "SpaceMono700", body: "SpaceGrotesk700" };

// How far the fake hard shadow peeks out past each widget's card, in dp —
// matches the app's own `theme.depth.e2` scale (5,5), the offset most of the
// app's own cards use for HardShadow.tsx. RemoteViews has no shadow/elevation
// prop at all (`CommonStyleProps` doesn't declare one), so every widget uses
// HardShadow.tsx's own trick: a solid ink rect sits BEHIND the card, and the
// card itself is inset from it by this amount on the right/bottom.
export const SHADOW_DX = 5;
export const SHADOW_DY = 5;
export const CARD_RADIUS = 16;

// Scheme-less resource names (not require()) → resolve to compiled
// res/drawable via BitmapFactory.decodeResource, a fast synchronous local
// decode; require() resolves to a Metro http URL fetched on every render,
// which crashed intermittently. The halftone drawables are the pre-baked
// card+dots texture (scripts/gen-widget-halftone.js — rasterized rather
// than rendered live via SvgWidget, since that widget's ImageView never
// sets a ScaleType and so letterboxes a non-square SVG instead of filling
// the card). Copied in by withWidgetAssets (app.config.ts).
// Fixed pre-scale resolution fed into ImageWidget before resizeMode="stretch"
// (ImageView.ScaleType.FIT_XY) stretches it to whatever the widget's real
// size turns out to be — matches scripts/gen-widget-halftone.js's own canvas.
export const HALFTONE_W = 480;
export const HALFTONE_H = 240;

// Daily strip 4×4's violet header banner gets its own white-dot texture
// overlay (rgba(255,255,255,.18) per the mock, identical in both themes —
// see scripts/gen-widget-halftone.js's `renderBannerDots`).
export const BANNER_DOTS = "widget_banner_dots" as unknown as ImageWidgetSource;
export const BANNER_DOTS_W = 480;
export const BANNER_DOTS_H = 160;

// Fixed banner heights — the single source both the widget components AND
// snapshot.ts's row-count chrome budget read from, so a header tweak can't
// silently desync the two the way a purely-guessed chrome constant already
// did once earlier this session (rows clipped off the bottom because the
// budget didn't know the real layout had grown).
// Daily strip's banner is a 3-layer OverlapWidget stack (fill + dot texture
// + content) that needs an explicit height for all three layers to agree
// on, rather than relying on Android FrameLayout's wrap-to-tallest-child
// two-pass measure — unverified without a live test, not worth the risk
// when a fixed number removes the ambiguity outright: 40dp icon tile + 12dp
// padding top/bottom.
export const DAILY_STRIP_BANNER_HEIGHT = 64;
// Today 4×2's header is a single FlexWidget row (no stacking ambiguity, safe
// to just wrap_content in the component) — this is only an estimate for the
// chrome budget: 24dp icon tile + 9dp padding top/bottom, +2dp for the
// Bangers line's own overshoot at this size.
export const TODAY_BANNER_HEIGHT = 44;

// Combo 2×2's starburst badge (scripts/gen-widget-starburst.js) — a raster
// PNG since RemoteViews has no clip-path/polygon support for the mock's
// star shape.
export const STARBURST_LIGHT = "widget_starburst_light" as unknown as ImageWidgetSource;
export const STARBURST_DARK = "widget_starburst_dark" as unknown as ImageWidgetSource;
export const STARBURST_SIZE = 200;

export type WidgetPalette = {
  shadow: ColorProp;
  halftone: ImageWidgetSource;
  border: ColorProp;
  text: ColorProp;
  textFaded: ColorProp;
  checkbox: ColorProp;
  /** Icon-tile fill — ember-tinted in both themes; the tile holds Ember's
   * own silhouette (see `emberSvg.ts`), not the app's launcher icon. */
  tile: ColorProp;
  textShadow: ColorProp;
  /** Per-theme resolved accents every widget's banner/stamp/quest-bar needs
   * consistently swapped — centralized here so no widget file has to repeat
   * its own `dark ? widgetDark.gold : theme.color.gold` ternary. */
  gold: ColorProp;
  ember: ColorProp;
  success: ColorProp;
};

/** Shared light/dark tokens for every widget — the P2 mock's own "Night
 * Patrol" dark palette (`darkTheme.ts`); Android's RemoteViews renderer
 * swaps light/dark per the system day/night setting automatically. */
export function widgetPalette(dark: boolean | undefined): WidgetPalette {
  if (dark) {
    return {
      shadow: widgetDark.ink as ColorProp,
      halftone: "widget_halftone_dark" as unknown as ImageWidgetSource,
      border: widgetDark.border as ColorProp,
      text: widgetDark.text as ColorProp,
      textFaded: widgetDark.textFaded as ColorProp,
      checkbox: widgetDark.track as ColorProp,
      tile: widgetDark.ember as ColorProp,
      textShadow: widgetDark.ink as ColorProp,
      gold: widgetDark.gold as ColorProp,
      ember: widgetDark.ember as ColorProp,
      success: widgetDark.success as ColorProp,
    };
  }
  return {
    shadow: theme.color.ink as ColorProp,
    halftone: "widget_halftone_light" as unknown as ImageWidgetSource,
    border: theme.color.ink as ColorProp,
    text: theme.color.ink as ColorProp,
    textFaded: "rgba(36, 27, 51, 0.5)" as ColorProp,
    checkbox: "#FFFFFF" as ColorProp,
    tile: theme.color.ember as ColorProp,
    textShadow: theme.color.ink as ColorProp,
    gold: theme.color.gold as ColorProp,
    ember: theme.color.ember as ColorProp,
    success: theme.color.success as ColorProp,
  };
}
