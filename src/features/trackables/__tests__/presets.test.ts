import { describe, it, expect } from "vitest";
import { STARTER_HABITS, presetToFormValues } from "../presets";
import { DIFFICULTY_BASE } from "@/features/gamification/constants";

describe("STARTER_HABITS", () => {
  it("pays exactly what its difficulty is worth — a preset must not mint its own rate", () => {
    // The real guard here. A preset is a pre-filled version of the same form a
    // user would fill in, so its payout has to come from DIFFICULTY_BASE like
    // any hand-made habit. Hardcoding a coin value that drifted from the
    // difficulty would quietly hand out the wrong coins forever.
    for (const p of STARTER_HABITS) {
      expect(presetToFormValues(p).coinValue, p.name).toBe(DIFFICULTY_BASE[p.difficulty]);
    }
  });

  it("produces habits that are actually due every day", () => {
    // A starter habit that isn't due on day one would leave a brand-new account
    // still looking empty, which defeats the entire point.
    for (const p of STARTER_HABITS) {
      const v = presetToFormValues(p);
      expect(v.kind, p.name).toBe("habit");
      expect(v.period, p.name).toBe("day");
      expect(v.quota, p.name).toBe(1);
      expect(v.weekdays, p.name).toBeNull();
    }
  });

  it("offers a usable spread without overwhelming the empty state", () => {
    expect(STARTER_HABITS.length).toBeGreaterThanOrEqual(4);
    expect(STARTER_HABITS.length).toBeLessThanOrEqual(8);
    expect(new Set(STARTER_HABITS.map((p) => p.name)).size).toBe(STARTER_HABITS.length);
    expect(new Set(STARTER_HABITS.map((p) => p.emoji)).size).toBe(STARTER_HABITS.length);
  });

  it("includes at least one break-a-habit preset, so reduce mode is discoverable", () => {
    // goalType 'reduce' is otherwise buried in the add form's Goal control;
    // nothing tells a new user it exists.
    expect(STARTER_HABITS.some((p) => p.goalType === "reduce")).toBe(true);
  });
});
