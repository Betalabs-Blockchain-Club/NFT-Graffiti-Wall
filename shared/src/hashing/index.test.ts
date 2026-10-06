import { describe, expect, it } from "vitest";
import { sha256Bytes } from "./index.js";

describe("sha256Bytes", () => {
  it("returns the standard SHA-256 vector for abc", async () => {
    const bytes = new TextEncoder().encode("abc");

    await expect(sha256Bytes(bytes)).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
