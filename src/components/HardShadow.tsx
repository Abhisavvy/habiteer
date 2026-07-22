import type { ReactNode } from "react";
import { View, Pressable, Animated, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle, GestureResponderEvent } from "react-native";

/**
 * Drop-in replacement for View/Pressable wherever a style carries
 * shadowColor/shadowOffset — Android has no native equivalent of the
 * hard, non-blurred, exact-offset shadow this app's neobrutalist system
 * calls for (`shadowColor`/`shadowOffset`/`shadowRadius` are no-ops there,
 * and `elevation`'s soft Material shadow isn't the same look even when it
 * renders at all). Renders the shadow as an actual solid-color layer
 * instead, so it looks identical on both platforms.
 *
 * Pass the exact same style object used before — this reads
 * `shadowColor`/`shadowOffset`/`borderRadius` off it and strips the
 * (now-inert) shadow* keys before applying the rest to the visible box.
 * No shadowColor/offset present → renders as a plain View/Pressable.
 *
 * `opacity`/`transform` (static or from `animatedStyle`) apply to the
 * WRAPPER, once, around the already-composited shadow+content — never to
 * the content box alone. A semi-transparent content box would let the
 * shadow layer bleed through everywhere they overlap (nearly the whole
 * box, not just the offset sliver), washing the whole thing grey instead
 * of fading the finished shadow+content picture as one unit.
 */
// Keys about this element's relationship to its SIBLINGS — how much space it
// claims/skips in the parent's flex flow, and where it sits if positioned.
// These move to the wrapper. width/height/borderRadius etc. stay on the
// content box — they define the visible box's OWN size (e.g. a 46x46
// circular button), and the wrapper just shrink-wraps around content+margin,
// so a fixed-size element keeps its exact diameter instead of being resized.
const SLOT_KEYS = [
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "zIndex",
] as const;

// width/height (and min/max variants) are ambiguous: a fixed pixel value
// defines the content box's OWN size (a 46x46 circle) and must stay on the
// content box, but a percentage resolves against the immediate PARENT's
// size — for something like a wrapping stat-grid cell at width:"47.5%",
// that parent must be the grandparent's flex context, so it has to move to
// the wrapper. Route by value type rather than key name.
const SIZE_KEYS = ["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight"] as const;

export function HardShadow({
  style,
  children,
  onPress,
  disabled,
  animatedStyle,
  ...rest
}: {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  /** Extra opacity/transform (may be Animated.Value-driven) for the whole
   * shadowed box — use when the whole box needs to animate in/out, not
   * just its children. Forces the wrapper to render as Animated.View. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animatedStyle?: { opacity?: any; transform?: any };
  [key: string]: unknown;
}) {
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle & {
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
  };
  const { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation, ...rest2 } = flat;
  const dx = shadowOffset?.width ?? 0;
  const dy = shadowOffset?.height ?? 0;

  if (!shadowColor || (!dx && !dy) || shadowOpacity === 0) {
    const NoShadowInner = animatedStyle ? Animated.View : onPress ? Pressable : View;
    return (
      <NoShadowInner style={[rest2, animatedStyle]} onPress={onPress} disabled={disabled} {...rest}>
        {children}
      </NoShadowInner>
    );
  }

  // Pull opacity/transform out of the content style entirely — they apply
  // once, to the wrapper, around the pre-composited shadow+content.
  const { opacity: staticOpacity, transform: staticTransform, ...rest3 } = rest2;
  const boxOpacity = animatedStyle?.opacity ?? staticOpacity;
  const boxTransform = animatedStyle?.transform ?? staticTransform;

  const slotStyle: Record<string, unknown> = {};
  const contentStyle: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest3)) {
    const isPercentSize = (SIZE_KEYS as readonly string[]).includes(key) && typeof value === "string";
    if ((SLOT_KEYS as readonly string[]).includes(key) || isPercentSize) slotStyle[key] = value;
    else contentStyle[key] = value;
  }
  // Original margin*/position already moved to slotStyle above (spacing to
  // siblings stays exactly as before) — these are purely to grow the
  // wrapper enough to fit the shadow layer poking out past the content box.
  contentStyle.marginRight = dx;
  contentStyle.marginBottom = dy;

  const Wrapper = boxOpacity !== undefined || boxTransform !== undefined ? Animated.View : View;
  const Inner = onPress ? Pressable : View;
  // Without this, RN/Android multiplies opacity down to each child
  // independently instead of flattening shadow+content into one texture
  // first — the shadow would bleed through the whole content box (nearly
  // all of it overlaps the shadow layer), not just the true offset sliver.
  const wrapperProps = boxOpacity !== undefined ? { needsOffscreenAlphaCompositing: true } : {};

  return (
    <Wrapper style={[slotStyle, { opacity: boxOpacity, transform: boxTransform }]} {...wrapperProps}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { top: dy, left: dx, backgroundColor: shadowColor, borderRadius: (contentStyle.borderRadius as number) ?? 0 },
        ]}
      />
      <Inner style={contentStyle} onPress={onPress} disabled={disabled} {...rest}>
        {children}
      </Inner>
    </Wrapper>
  );
}
