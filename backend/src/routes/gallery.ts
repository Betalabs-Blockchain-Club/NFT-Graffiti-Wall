import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { route } from "../db/http.js";
import { GALLERY_STATUSES, type GalleryStatus } from "../db/types.js";
import { StorageError } from "../db/errors.js";
import type { Storage } from "../services/storage.js";

export function createGalleryRouter({ storage, adminToken }: { storage: Storage; adminToken: string }): Router {
  const router = Router(), authorize = adminAuth(adminToken);
  router.get("/api/gallery", (req, res, next) => {
    const status = req.query.status ?? "approved";
    if (status === "approved") next();
    else authorize(req, res, next);
  }, route((req, res) => {
    const status = req.query.status ?? "approved";
    const limit = req.query.limit === undefined ? 48 : Number(req.query.limit);
    if (typeof status !== "string" || !GALLERY_STATUSES.includes(status as GalleryStatus)
      || (req.query.limit !== undefined && (typeof req.query.limit !== "string" || !/^\d+$/.test(req.query.limit)))
      || (req.query.cursor !== undefined && typeof req.query.cursor !== "string")) {
      throw new StorageError("invalid-query", "Invalid gallery query");
    }
    res.json(storage.list({ status: status as GalleryStatus, limit, cursor: req.query.cursor as string | undefined }));
  }));
  return router;
}
