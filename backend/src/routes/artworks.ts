import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Storage } from "../services/storage.js";
import type { createMintQueue } from "../services/queue.js";
import { createUploadMiddleware } from "../middleware/validate.js";
import { createRateLimit } from "../middleware/rateLimit.js";

type Queue = ReturnType<typeof createMintQueue>;

export interface ArtworksOptions {
  storage: Storage;
  queue: Queue;
  maxImageKb: number;
  rateLimitPerMinute: number;
  deviceKey: (req: import("express").Request) => string;
}

export function createArtworksRouter({ storage, queue, maxImageKb, rateLimitPerMinute, deviceKey }: ArtworksOptions) {
  const router = Router();
  router.post("/", createRateLimit({ perMinute: rateLimitPerMinute, keyFn: deviceKey }), (req, res, next) => {
    if (storage.getConfig("KILL_SWITCH")) {
      res.status(503).json({ code: "kill-switch", message: "Minting is temporarily disabled" });
      return;
    }
    next();
  }, createUploadMiddleware({ maxKb: maxImageKb }), (req, res, next) => {
    try {
      const upload = req.upload;
      if (!upload) throw new Error("Upload validation did not produce an image");
      const jobId = randomUUID();
      storage.insertArtwork({ id: jobId, nickname: upload.nickname, sha256: upload.sha256 });
      queue.enqueue({ jobId, pngBytes: upload.bytes, nickname: upload.nickname, clientHash: upload.sha256 });
      res.status(202).json({ jobId, status: "pending" });
    } catch (error) {
      next(error);
    }
  });
  router.get("/:jobId/status", (req, res) => {
    const job = queue.getStatus(req.params.jobId);
    if (job) return res.json(job);
    if (!storage.getById(req.params.jobId)) return res.status(404).json({ code: "not_found", message: "Mint job not found" });
    return res.status(404).json({ code: "not_found", message: "Mint job status is unavailable" });
  });
  return router;
}
