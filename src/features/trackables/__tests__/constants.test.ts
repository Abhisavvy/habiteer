import { describe, it, expect } from "vitest";
import { reductionFraming } from "../constants";

describe("reductionFraming", () => {
  it("frames a build habit with the standard done/streak treatment", () => {
    const f = reductionFraming("build");
    expect(f.doneStamp).toBe("DONE ✓");
    expect(f.streakEmoji).toBe("🔥");
    expect(f.pill).toBeNull();
  });

  it("frames a reduce habit as resisting / a protected streak", () => {
    const f = reductionFraming("reduce");
    expect(f.doneStamp).toBe("RESISTED ✓");
    expect(f.streakEmoji).toBe("🛡️");
    expect(f.pill).toBe("REDUCE");
  });
});
