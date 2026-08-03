export type EmberExpression = "neutral" | "celebrate" | "sleepy";

/** Streak → expression tier. 0 = sleepy (nothing done yet, no momentum);
 * 1–6 = neutral; 7+ = celebrate — 7 matches the app's own first COMBO_TIERS
 * threshold (gamification/constants.ts), so "Ember's excited" lines up with
 * the same streak length that already unlocks a real in-app reward, not an
 * arbitrary new number. Kept in its own dependency-free module (not inside
 * `Ember.tsx`) so `features/widget/emberSvg.ts` — deliberately free of any
 * react-native-svg import, since it's used in a headless RemoteViews
 * rendering context and unit-tested with zero mocking — can share this
 * exact mapping without pulling in a native-module dependency chain. */
export function expressionForStreak(streak: number): EmberExpression {
  if (streak <= 0) return "sleepy";
  if (streak >= 7) return "celebrate";
  return "neutral";
}
