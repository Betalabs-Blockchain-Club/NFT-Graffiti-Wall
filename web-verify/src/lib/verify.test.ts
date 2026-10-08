import { describe, expect, it, vi } from "vitest";
import { buildGatewayUrls, fetchImageWithFallback, sha256Hex } from "./verify";
describe("verification helpers", () => {
  it("keeps the CID path and trims gateway slashes", () => expect(buildGatewayUrls("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3pteyj2hudqjohfpnbshqrnu4", ["https://one.example/ipfs/"])).toEqual(["https://one.example/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3pteyj2hudqjohfpnbshqrnu4"]));
  it("recomputes SHA-256 from the exact bytes", async () => expect(await sha256Hex(new TextEncoder().encode("graffiti").buffer)).toBe("8a61a6f6d4d05bbe04c6e4f2bfd147240911253ebac3556bee753e18b42eaf4e"));
  it("uses the next gateway after the first fails", async () => { const fetcher = vi.fn().mockResolvedValueOnce(new Response("missing", { status: 404 })).mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 })); const result = await fetchImageWithFallback("cid", ["https://one.example/ipfs", "https://two.example/ipfs"], fetcher); expect(result.imageUrl).toBe("https://two.example/ipfs/cid"); expect(new Uint8Array(result.bytes)).toEqual(new Uint8Array([1, 2, 3])); });
});
