/**
 * Widget-only dark palette. Values for bg/card/track/border/accent are taken
 * verbatim from the design's S8 "Dark mode — a peek" mockup (rendered as
 * literal rgb() in its DOM, converted to hex below); semantic colors
 * (yellow/jade/fire) are unchanged, confirmed identical in that same
 * mockup. `doneCard` has no mockup example to lift from (S8 only shows
 * undone rows) — it's an analogous interpolation toward violet, same as
 * how the light widget's own done-tint was never lifted from a specific
 * mockup either (`HabitWidget.tsx`'s existing "approximates the app's
 * look" precedent).
 */
export const widgetDark = {
  bg: "#151021", // page background in the S8 mockup
  card: "#221B33", // undone row card background
  doneCard: "#2E2647", // interpolated — no dark done-row example in the mockup
  track: "#241D33", // check-button (undone) background
  border: "#F3F0FF", // "ink borders invert to paper" per the mockup's own rationale
  text: "#F3F0FF",
  textFaded: "rgba(243,240,255,0.5)",
  accentViolet: "#A78BFF",
} as const;
