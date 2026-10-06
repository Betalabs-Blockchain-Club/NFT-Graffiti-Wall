import { describe, expect, it } from "vitest";
import { buildVerifyUrl, parseTokenId } from "./index.js";

describe("verification URLs", () => {
  it("builds the frozen token URL format", () => {
    expect(buildVerifyUrl("https://verify.example/", 37)).toBe(
      "https://verify.example/#/token/37"
    );
  });

  it("parses a token ID from a verification URL", () => {
    expect(parseTokenId("https://verify.example/#/token/37")).toBe(37);
    expect(parseTokenId("https://verify.example/#/artwork/37")).toBeNull();
  });
});
