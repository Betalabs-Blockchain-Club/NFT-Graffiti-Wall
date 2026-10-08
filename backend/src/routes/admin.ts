import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { route } from "../db/http.js";
import { toGalleryItem, type GalleryItem } from "../db/types.js";
import { StorageError } from "../db/errors.js";
import type { Storage } from "../services/storage.js";
import type { createMintQueue } from "../services/queue.js";

type Queue = ReturnType<typeof createMintQueue>;

export interface AdminOptions {
  storage: Storage;
  queue: Queue;
  adminToken: string;
  hooks: { onApproved: (item: GalleryItem) => void | Promise<void>; onHidden: (id: string) => void | Promise<void> };
}

export function createAdminRouter({ storage, queue, adminToken, hooks }: AdminOptions): Router {
  const router = Router();
  router.use("/api/admin", adminAuth(adminToken));
  router.post("/api/admin/artworks/:jobId/mint", route(async (req, res) => {
    const existing = storage.getById(req.params.jobId);
    if (!existing) throw new StorageError("not-found", "Artwork not found", 404);
    if (existing.tokenId != null && existing.status === "approved") {
      return res.json({ item: toGalleryItem(existing) });
    }
    if (existing.status !== "pending") throw new StorageError("not-ready", "Only pending artwork can be minted", 409);
    const currentJob = queue.getStatus(req.params.jobId);
    if (currentJob?.stage !== "ready" && !(currentJob?.stage === "failed" && currentJob.imageCID)) {
      throw new StorageError("not-ready", currentJob?.error ?? "Artwork is still being prepared for minting", 409);
    }
    const job = await queue.mint(req.params.jobId);
    if (job.stage !== "confirmed") throw new StorageError("mint-failed", job.error ?? "Mint transaction failed", 502);
    const item = toGalleryItem(storage.getById(req.params.jobId)!);
    await hooks.onApproved(item);
    res.json({ item, job });
  }));
  router.post("/api/admin/artworks/:jobId/retry-ipfs", route(async (req, res) => {
    const existing = storage.getById(req.params.jobId);
    if (!existing) throw new StorageError("not-found", "Artwork not found", 404);
    if (existing.status !== "pending") throw new StorageError("not-ready", "Only pending artwork can be retried", 409);
    const job = await queue.retryPin(req.params.jobId);
    res.json({ job });
  }));
  router.post("/api/admin/artworks/:jobId/hide", route(async (req, res) => {
    const artwork = storage.setStatus(req.params.jobId, "hidden");
    await hooks.onHidden(artwork.id);
    res.json({ item: toGalleryItem(artwork) });
  }));
  router.post("/api/admin/artworks/:jobId/restore", route(async (req, res) => {
    const artwork = storage.getById(req.params.jobId);
    if (!artwork) throw new StorageError("not-found", "Artwork not found", 404);
    const item = toGalleryItem(storage.setStatus(req.params.jobId, artwork.tokenId == null ? "pending" : "approved"));
    if (item.status === "approved") await hooks.onApproved(item);
    res.json({ item });
  }));
  router.put("/api/admin/config", route((req, res) => {
    res.json(storage.setConfig(req.body));
  }));
  router.post("/api/admin/reset", route(async (req, res) => {
    const confirmation = `ARCHIVE ${new Date().toISOString().slice(0, 10)}`;
    if (req.body?.confirm !== confirmation) {
      throw new StorageError("invalid-confirmation", "Exact archive confirmation for today's UTC date is required");
    }
    // Collect public ids before archiving so the wall can remove them afterward.
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = storage.list({ status: "approved", limit: 100, cursor });
      ids.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    const archive = storage.archiveAll();
    // Attempt every notification even if one hook fails after the DB commit.
    const notified = await Promise.allSettled(ids.map((id) => Promise.resolve().then(() => hooks.onHidden(id))));
    if (notified.some((result) => result.status === "rejected")) throw new Error("Archive notification failed");
    res.json({ ok: true, ...archive });
  }));
  router.post("/api/admin/clear-gallery", route(async (req, res) => {
    if (req.body?.confirm !== "CLEAR GALLERY") {
      throw new StorageError("invalid-confirmation", "Explicit gallery clear confirmation is required");
    }
    const archive = storage.archiveByStatus("approved");
    const notified = await Promise.allSettled(archive.ids.map((id) => Promise.resolve().then(() => hooks.onHidden(id))));
    if (notified.some((result) => result.status === "rejected")) throw new Error("Gallery clear notification failed");
    res.json({ ok: true, archiveId: archive.archiveId, artworkCount: archive.artworkCount, voteCount: archive.voteCount });
  }));
  router.post("/api/admin/clear-mint-requests", route((req, res) => {
    if (req.body?.confirm !== "CLEAR MINT REQUESTS") {
      throw new StorageError("invalid-confirmation", "Explicit mint request clear confirmation is required");
    }
    const requestIds: string[] = [];
    let cursor: string | undefined;
    do {
      const page = storage.list({ status: "pending", limit: 100, cursor });
      requestIds.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    const excludedIds: string[] = [];
    for (const id of requestIds) {
      const job = queue.getStatus(id);
      if (job?.stage === "minting" || !queue.cancel(id)) excludedIds.push(id);
    }
    const archive = storage.archiveByStatus("pending", excludedIds);
    res.json({ ok: true, skippedMintingCount: excludedIds.length, archiveId: archive.archiveId,
      artworkCount: archive.artworkCount, voteCount: archive.voteCount });
  }));
  return router;
}
