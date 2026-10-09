import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createArtworksRouter } from "./artworks.js";
import type { Storage } from "../services/storage.js";
import type { createMintQueue } from "../services/queue.js";

function appFor(artwork: Record<string, unknown> | undefined) {
  const storage = { getById: vi.fn().mockResolvedValue(artwork) } as unknown as Storage;
  const queue = { getStatus: vi.fn().mockReturnValue(undefined) } as unknown as ReturnType<typeof createMintQueue>;
  const app = express();
  app.use("/api/artworks", createArtworksRouter({
    storage,
    queue,
    maxImageKb: 500,
    rateLimitPerMinute: 10,
    deviceKey: () => "test-device",
  }));
  return app;
}

describe("artwork status recovery", () => {
  it("recovers a confirmed mint from its durable receipt after queue state is gone", async () => {
    const response = await request(appFor({
      id: "job-1",
      tokenId: 12,
      txHash: "0xreceipt",
      imageCID: "bafy-image",
      metadataCID: "bafy-metadata",
    })).get("/api/artworks/job-1/status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      jobId: "job-1",
      stage: "confirmed",
      tokenId: 12,
      txHash: "0xreceipt",
      imageCID: "bafy-image",
      metadataCID: "bafy-metadata",
      retry: 0,
    });
  });

  it("keeps unavailable and missing jobs distinct when no receipt is stored", async () => {
    const pending = await request(appFor({ id: "job-1", tokenId: null, txHash: null })).get("/api/artworks/job-1/status");
    const missing = await request(appFor(undefined)).get("/api/artworks/missing/status");
    expect(pending.status).toBe(404);
    expect(pending.body.message).toBe("Mint job status is unavailable");
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe("Mint job not found");
  });
});
