import { TextWidget } from "react-native-android-widget";
import { theme } from "@/constants/theme";
import { FONT } from "./palette";
import { WidgetCardFrame } from "./WidgetCardFrame";
import type { WidgetSnapshot } from "./snapshot";

/**
 * Home-screen widget (P2 "07 Widget suite · Streak 2×2") — the big
 * glanceable streak: a 🔥 emoji, the streak number in Bangers, "DAY STREAK"
 * beneath it, on a solid ember card (the mock's own spec — no halftone
 * texture on this one). Deliberately the simplest widget in the suite; a
 * single number is the whole point. Tapping anywhere opens Today
 * (`WidgetCardFrame`'s own root clickAction).
 */
export function StreakWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  return (
    <WidgetCardFrame dark={dark} solidFill={theme.color.ember} contentPadding={6}>
      <TextWidget text="🔥" style={{ fontSize: 28, width: "match_parent", textAlign: "center" }} />
      <TextWidget
        text={String(snapshot.topStreak)}
        style={{
          fontSize: 26,
          fontFamily: FONT.heading,
          color: theme.color.gold,
          textAlign: "center",
          width: "match_parent",
          textShadowColor: theme.color.ink,
          textShadowOffset: { width: 1.5, height: 1.5 },
          textShadowRadius: 0,
        }}
      />
      <TextWidget
        text="DAY STREAK"
        style={{
          fontSize: 9,
          fontFamily: FONT.mono,
          fontWeight: "bold",
          color: "#FFFFFF",
          textAlign: "center",
          width: "match_parent",
          letterSpacing: 0.5,
        }}
      />
    </WidgetCardFrame>
  );
}
