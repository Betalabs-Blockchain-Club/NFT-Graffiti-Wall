import { describe, expect, it } from "vitest";
import { containsProfanity, validateNickname } from "./index.js";

describe("nickname validation", () => {
  it("trims valid nicknames", () => {
    expect(validateNickname("  Pixel Fox  ")).toEqual({
      ok: true,
      value: "Pixel Fox"
    });
  });

  it("rejects empty, oversized, and profane nicknames", () => {
    expect(validateNickname("   ")).toEqual({ ok: false, reason: "empty" });
    expect(validateNickname("a".repeat(33))).toEqual({ ok: false, reason: "too_long" });
    expect(validateNickname("  shit  ")).toEqual({ ok: false, reason: "profanity" });
  });

  it("matches profanity as a word, not as part of an innocent word", () => {
    expect(containsProfanity("This is shit!")).toBe(true);
    expect(containsProfanity("Scunthorpe")).toBe(false);
  });
});
