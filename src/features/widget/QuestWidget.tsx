import { FlexWidget, TextWidget } from "react-native-android-widget";
import { FONT, widgetPalette } from "./palette";
import { WidgetCardFrame } from "./WidgetCardFrame";
import type { WidgetSnapshot } from "./snapshot";

/**
 * Home-screen widget (P2 "07 Widget suite · Quest 4×2").
 *
 * Wired to the real weekly quest system (`quest_claims` table, `fn_claim_quest`
 * RPC, `src/features/quests/` — also shown on `app/quests.tsx`) via
 * `snapshot.featuredQuest` (see `featuredQuestStatus` in
 * `quests/derived.ts`, plumbed through `snapshot.ts`): an unclaimed quest
 * that's already met is featured first (ready to claim), else the active
 * quest closest to its own goal. The mock's own "QUEST OF THE DAY" header
 * text is deliberately NOT reproduced verbatim — the underlying data is a
 * WEEKLY quest, not a daily one, and the literal mock copy would state
 * something false about it (same precedent as the streak-freeze modal's
 * copy elsewhere in this app). Read-only, like the rest of this widget
 * suite — claiming happens in the app, not here.
 */
export function QuestWidget({ snapshot, dark }: { snapshot: WidgetSnapshot; dark?: boolean }) {
  const p = widgetPalette(dark);
  const q = snapshot.featuredQuest;
  const pct = q ? Math.max(0, Math.min(100, (q.progress / q.goal) * 100)) : 0;
  const badgeText = q ? (q.claimed ? "CLAIMED ✓" : q.met ? `CLAIM! 🪙${q.reward}` : `+${q.reward} 🪙`) : "";

  return (
    <WidgetCardFrame dark={dark} contentPadding={12}>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", marginBottom: 9 }}>
        <TextWidget text="🎯" style={{ fontSize: 16, marginRight: 7 }} />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text="WEEKLY QUEST" style={{ fontSize: 16, fontFamily: FONT.heading, color: p.text }} />
        </FlexWidget>
      </FlexWidget>

      {!q ? (
        <FlexWidget style={{ width: "match_parent", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <TextWidget text="🌤" style={{ fontSize: 22 }} />
          <TextWidget text="No quest this week" style={{ fontSize: 13, fontFamily: FONT.body, fontWeight: "bold", color: p.text, marginTop: 2 }} />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          <TextWidget
            text={`${q.emoji} ${q.title}`}
            style={{ fontSize: 13, fontFamily: FONT.body, fontWeight: "bold", color: p.text, marginBottom: 7 }}
          />
          <FlexWidget
            style={{
              width: "match_parent",
              height: 14,
              flexDirection: "row",
              backgroundColor: "#FFFFFF",
              borderWidth: 2,
              borderColor: p.border,
              borderRadius: 999,
              marginBottom: 9,
            }}
          >
            <FlexWidget style={{ flex: Math.max(6, pct), height: "match_parent", backgroundColor: p.success, borderRadius: 999 }} />
            <FlexWidget style={{ flex: Math.max(0, 100 - pct) }} />
          </FlexWidget>
          <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget
                text={`${Math.min(q.progress, q.goal)} / ${q.goal}`}
                style={{ fontSize: 11, fontFamily: FONT.mono, fontWeight: "bold", color: p.textFaded }}
              />
            </FlexWidget>
            <FlexWidget
              style={{
                backgroundColor: p.gold,
                borderWidth: 3,
                borderColor: p.border,
                borderRadius: 9,
                paddingHorizontal: 10,
                paddingVertical: 4,
                rotation: -3,
              }}
            >
              <TextWidget text={badgeText} style={{ fontSize: 13, fontFamily: FONT.heading, color: p.border }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
      )}
    </WidgetCardFrame>
  );
}
