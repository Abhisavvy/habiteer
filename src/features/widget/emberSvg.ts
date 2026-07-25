export type EmberExpression = "neutral" | "celebrate" | "sleepy";

/**
 * Ember — the P2 "comic-book" redesign's flame-drop mascot (ember-orange
 * body, gold belly), read verbatim from `Habiteer P2 - Screens.dc.html`'s
 * "07 WIDGET SUITE" section (the same exact path appears 17 times across
 * that file, vs. a single leftover instance of an older violet-ghost
 * design this file previously carried — confirmed stale by that count,
 * not just eyeballing one section). `SvgWidget` (the RemoteViews
 * primitive) takes markup, not react-native-svg components, hence a raw
 * string. Safe to render live here (unlike the card halftone, which had
 * to be pre-baked as a PNG): Ember's own viewBox is square (130×130), and
 * the Companion widget it's used in is square too, so AndroidSVG's
 * letterbox-on-mismatched-aspect behavior never triggers.
 *
 * Only the widget suite's copy of Ember is updated here — this file has
 * always been a RemoteViews-only port, separate from `components/
 * Ember.tsx`'s in-app version. That in-app version (and anywhere else it
 * appears) still uses the older design; bringing the rest of the app in
 * line with this same P2 mascot update is a separate, larger pass than
 * "fix the widget suite," out of scope here.
 */
export function emberSvg(expression: EmberExpression = "neutral"): string {
  const eyes =
    expression === "sleepy"
      ? `<path d="M48 75 h12" stroke="#241B33" stroke-width="3.5" stroke-linecap="round"/>
         <path d="M72 75 h12" stroke="#241B33" stroke-width="3.5" stroke-linecap="round"/>`
      : `<circle cx="54" cy="75" r="3.6" fill="#241B33"/>
         <circle cx="78" cy="75" r="3.6" fill="#241B33"/>`;

  const mouth =
    expression === "celebrate"
      ? `<path d="M55 84 Q65 96 75 84 Z" fill="#241B33"/>`
      : `<path d="M60 85 Q65 90 70 85" fill="none" stroke="#241B33" stroke-width="3" stroke-linecap="round"/>`;

  return `<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
    <path d="M65 116 C34 116 26 90 33 68 C38 53 50 50 51 39 C52 30 47 22 57 12 C60 25 71 26 72 41 C81 34 89 42 91 55 C97 76 96 116 65 116 Z" fill="#FF6A3D" stroke="#241B33" stroke-width="5" stroke-linejoin="round"/>
    <path d="M65 108 C46 108 40 92 44 76 C47 66 55 63 57 55 C63 66 78 73 78 90 C78 102 74 108 65 108 Z" fill="#FFC23C"/>
    ${eyes}
    ${mouth}
  </svg>`;
}

/** Streak → expression tier. 0 = Ember's sleepy (nothing done yet today's
 * habits haven't built momentum); 1–6 = neutral; 7+ = celebrate — 7 matches
 * the app's own first COMBO_TIERS threshold (gamification/constants.ts), so
 * "Ember's excited" lines up with the same streak length that already
 * unlocks a real in-app reward, not an arbitrary new number. */
export function expressionForStreak(streak: number): EmberExpression {
  if (streak <= 0) return "sleepy";
  if (streak >= 7) return "celebrate";
  return "neutral";
}
