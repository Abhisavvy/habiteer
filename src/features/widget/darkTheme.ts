/**
 * Widget-only dark palette — "Night Patrol", the P2 comic-book mock's own
 * dark variant (`Habiteer P2 - Screens.dc.html`, "07 WIDGET SUITE" 🌙
 * section). Values are read verbatim from that mock's inline styles, not
 * interpolated from the light palette or an older redesign's dark mode
 * (an earlier version of this file held the *previous* S8 mockup's dark
 * values, which is a different design pass entirely — confirmed stale by
 * diffing against the current mock directly).
 */
export const widgetDark = {
  ink: "#0C0916", // border/shadow color — the dark analog of theme.color.ink
  card: "#2E2447", // card fill (both undone + done rows share this in the mock)
  track: "#1A1526", // check-button (undone) background
  border: "#0C0916", // card border color in dark mode (same as ink here, not paper)
  text: "#F4EEDF",
  textFaded: "rgba(244,238,223,.6)",
  hero: "#8B63FF",
  gold: "#FFD23F",
  ember: "#FF7A4D",
  success: "#2ADBA0",
} as const;
