import Database from "better-sqlite3";
import express from "express";
import { vi } from "vitest";
import { createStorage, type Storage } from "../services/storage.js";
import { createGalleryRouter } from "../routes/gallery.js";
import { createAdminRouter } from "../routes/admin.js";
import { createVotesRouter } from "../routes/votes.js";
import type { ArtworkStatus } from "./types.js";

export const ADMIN_TOKEN = "test-admin-token";
export function fixture() {
  const db = new Database(":memory:");
  const storage = createStorage(db);
  const hooks = { onApproved: vi.fn(), onHidden: vi.fn() };
  const app = express();
  app.use(express.json());
  app.use(createGalleryRouter({ storage, adminToken: ADMIN_TOKEN }));
  app.use(createAdminRouter({ storage, adminToken: ADMIN_TOKEN, hooks }));
  app.use(createVotesRouter({ storage }));
  return { db, storage, hooks, app };
}

export function seed(storage: Storage, id = "art-1", status: ArtworkStatus = "pending", createdAt?: string) {
  storage.insertArtwork({ id, nickname: "Pixel Fox", sha256: "a".repeat(64), imageCID: `bafy-${id}`, createdAt });
  return storage.setStatus(id, status);
}
export const receipt = {
  id: "art-1", tokenId: 7, txHash: "0xreceipt", blockNumber: 42, imageCID: "bafy-image", metadataCID: "bafy-metadata"
};
