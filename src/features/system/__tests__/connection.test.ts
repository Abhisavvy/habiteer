import { describe, it, expect } from "vitest";
import { isConnectionError } from "../connection";

describe("isConnectionError", () => {
  it("flags RN/web fetch network failures", () => {
    expect(isConnectionError(new TypeError("Network request failed"))).toBe(true);
    expect(isConnectionError({ message: "Failed to fetch" })).toBe(true);
    expect(isConnectionError({ message: "network error" })).toBe(true);
    expect(isConnectionError("Network request failed")).toBe(true);
  });

  it("flags aborts/timeouts", () => {
    expect(isConnectionError({ name: "AbortError", message: "aborted" })).toBe(true);
    expect(isConnectionError({ message: "Request timed out" })).toBe(true);
  });

  it("does NOT flag normal API / business errors", () => {
    expect(isConnectionError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
    expect(isConnectionError(new Error("You haven't unlocked that yet."))).toBe(false);
    expect(isConnectionError({ message: "quest not complete" })).toBe(false);
  });

  it("is safe on empty/odd input", () => {
    expect(isConnectionError(null)).toBe(false);
    expect(isConnectionError(undefined)).toBe(false);
    expect(isConnectionError({})).toBe(false);
  });
});
