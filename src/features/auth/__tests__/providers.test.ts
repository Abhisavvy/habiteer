import { describe, it, expect } from "vitest";
import { isProviderEnabled } from "../providers";

describe("isProviderEnabled", () => {
  it("reads a provider's flag out of the settings payload", () => {
    expect(isProviderEnabled({ external: { google: true, apple: false } }, "google")).toBe(true);
    expect(isProviderEnabled({ external: { google: false, apple: false } }, "google")).toBe(false);
  });

  it("assumes ENABLED when the payload can't be understood", () => {
    // This gate only ever hides a button. If the probe fails or the shape
    // changes, hiding working sign-in would be the worse error — so an
    // unreadable answer must not be treated as "disabled".
    expect(isProviderEnabled(null, "google")).toBe(true);
    expect(isProviderEnabled({}, "google")).toBe(true);
    expect(isProviderEnabled({ external: {} }, "google")).toBe(true);
    expect(isProviderEnabled({ external: { google: "yes" } }, "google")).toBe(true);
  });
});
