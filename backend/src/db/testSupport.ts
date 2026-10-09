import { readFileSync } from "node:fs";
import express from "express";
import { Pool } from "pg";
import { vi } from "vitest";
import { createStorage, type Storage } from "../services/storage.js";
import { createGalleryRouter } from "../routes/gallery.js";
import { createAdminRouter } from "../routes/admin.js";
import type { createMintQueue } from "../services/queue.js";
import { createVotesRouter } from "../routes/votes.js";
import type { ArtworkStatus } from "./types.js";

export const ADMIN_TOKEN = "test-admin-token";
const configuredTestUrl = process.env.TEST_DATABASE_URL
  ?? "postgresql://graffiti:graffiti-test@127.0.0.1:55432/graffiti_test";
const testUrl = new URL(configuredTestUrl);
if (!(["localhost", "127.0.0.1", "::1"].includes(testUrl.hostname)
  && testUrl.pathname === "/graffiti_test")) {
  throw new Error("PostgreSQL tests may only use the local graffiti_test database; refusing to connect to a non-disposable target.");
}
export const TEST_DATABASE_URL = configuredTestUrl;

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const admin = new Pool({ connectionString: TEST_DATABASE_URL, max: 2 });

/** Drop leftover test triggers, then reset every table to a clean, empty state. */
export async function resetDatabase() {
  await admin.query(schema);
  await admin.query("DROP TRIGGER IF EXISTS test_block_archive ON artworks");
  await admin.query("DROP FUNCTION IF EXISTS test_block_archive()");
  await admin.query("TRUNCATE artworks, votes, likes, api_rate_limits, config, archive_batches RESTART IDENTITY CASCADE");
}

export async function closeDatabase() {
  await admin.end();
}

/** Run a raw query against the shared test database (for assertions only). */
export function query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values: unknown[] = []) {
  return admin.query<T>(sql, values);
}

export async function fixture() {
  await resetDatabase();
  const storage = createStorage(TEST_DATABASE_URL);
  await storage.ready;
  const hooks = { onApproved: vi.fn(), onHidden: vi.fn() };
  // Mirrors the paths exercised by the admin router without importing the real
  // queue or chain. Storage is async, so the mint step awaits it.
  const queue = {
    getStatus: vi.fn((jobId: string) => ({
      jobId, stage: "ready" as const, imageCID: `bafy-${jobId}`, metadataCID: `bafy-meta-${jobId}`
    })),
    mint: vi.fn(async (jobId: string) => {
      const artwork = await storage.getById(jobId);
      if (!artwork) throw new Error("Artwork not found");
      await storage.setMinted({
        id: jobId, tokenId: 7, txHash: "0xreceipt", blockNumber: 42,
        imageCID: artwork.imageCID ?? "bafy-image", metadataCID: artwork.metadataCID ?? "bafy-metadata"
      });
      await storage.setStatus(jobId, "approved");
      return { jobId, stage: "confirmed" as const, tokenId: 7, txHash: "0xreceipt" };
    }),
    retryPin: vi.fn(async (jobId: string) => ({ job: { jobId, stage: "ready" as const } })),
    cancel: vi.fn(() => true)
  } as unknown as ReturnType<typeof createMintQueue>;
  const app = express();
  app.use(express.json());
  app.use(createGalleryRouter({ storage, adminToken: ADMIN_TOKEN }));
  app.use(createAdminRouter({ storage, queue, adminToken: ADMIN_TOKEN, hooks }));
  app.use(createVotesRouter({ storage }));
  return { storage, hooks, app, query, close: async () => { await storage.close(); } };
}

export async function seed(storage: Storage, id = "art-1", status: ArtworkStatus = "pending", createdAt?: string) {
  await storage.insertArtwork({ id, nickname: "Pixel Fox", sha256: "a".repeat(64), imageCID: `bafy-${id}`, createdAt });
  return storage.setStatus(id, status);
}

export const receipt = {
  id: "art-1", tokenId: 7, txHash: "0xreceipt", blockNumber: 42, imageCID: "bafy-image", metadataCID: "bafy-metadata"
};
