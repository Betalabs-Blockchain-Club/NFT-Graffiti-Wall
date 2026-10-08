import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { route } from "../db/http.js";
import { toGalleryItem, type GalleryItem } from "../db/types.js";
import { StorageError } from "../db/errors.js";
import type { Storage } from "../services/storage.js";

export interface AdminOptions {
  storage: Storage;
  adminToken: string;
  hooks: { onApproved: (item: GalleryItem) => void | Promise<void>; onHidden: (id: string) => void | Promise<void> };
}

export function createAdminRouter({ storage, adminToken, hooks }: AdminOptions): Router {
  const router = Router();
  router.use("/api/admin", adminAuth(adminToken));
  router.post("/api/admin/artworks/:jobId/approve", route(async (req, res) => {
    const item = toGalleryItem(storage.setStatus(req.params.jobId, "approved"));
    await hooks.onApproved(item);
    res.json({ item });
  }));
  router.post("/api/admin/artworks/:jobId/hide", route(async (req, res) => {
    const artwork = storage.setStatus(req.params.jobId, "hidden");
    await hooks.onHidden(artwork.id);
    res.json({ item: toGalleryItem(artwork) });
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
  return router;
}
