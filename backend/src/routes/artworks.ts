import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Storage } from "../services/storage.js";
import type { createMintQueue } from "../services/queue.js";
import { createUploadMiddleware } from "../middleware/validate.js";
import { createRateLimit } from "../middleware/rateLimit.js";
import { StorageError } from "../db/errors.js";

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
    void storage.getConfig("KILL_SWITCH").then((killSwitch) => { if (killSwitch) {
      res.status(503).json({ code: "kill-switch", message: "Minting is temporarily disabled" });
      return;
    } next(); }).catch(next);
  }, createUploadMiddleware({ maxKb: maxImageKb }), async (req, res, next) => {
    try {
      const upload = req.upload;
      if (!upload) throw new Error("Upload validation did not produce an image");
      const idempotencyKey = req.get("Idempotency-Key")?.trim();
      if (idempotencyKey && idempotencyKey.length > 128) {
        throw new StorageError("invalid-idempotency-key", "Idempotency key must be 128 characters or fewer", 400);
      }
      const replay = async (existing: Awaited<ReturnType<Storage["getByIdempotencyKey"]>>) => {
        if (!existing) return false;
        if (existing.sha256 !== upload.sha256.toLowerCase() || existing.nickname !== upload.nickname) {
          throw new StorageError("idempotency-conflict", "This submission key was already used for different artwork", 409);
        }
        const active = await storage.getById(existing.id);
        if (!active) throw new StorageError("submission-cleared", "This submission was already cleared by staff", 409);
        res.status(202).json({ jobId: active.id, status: active.status });
        return true;
      };
      if (idempotencyKey && await replay(await storage.getByIdempotencyKey(idempotencyKey))) return;
      const jobId = randomUUID();
      try {
        await storage.insertArtwork({ id: jobId, nickname: upload.nickname, sha256: upload.sha256, idempotencyKey });
      } catch (error) {
        if (idempotencyKey && ["23505", "SQLITE_CONSTRAINT_UNIQUE"].includes((error as { code?: string }).code ?? "")
          && await replay(await storage.getByIdempotencyKey(idempotencyKey))) return;
        throw error;
      }
      queue.enqueue({ jobId, pngBytes: upload.bytes, nickname: upload.nickname, clientHash: upload.sha256 });
      res.status(202).json({ jobId, status: "pending" });
    } catch (error) {
      next(error);
    }
  });
  router.get("/:jobId/status", async (req, res) => {
    const job = queue.getStatus(req.params.jobId);
    if (job) return res.json(job);
    if (!await storage.getById(req.params.jobId)) return res.status(404).json({ code: "not_found", message: "Mint job not found" });
    return res.status(404).json({ code: "not_found", message: "Mint job status is unavailable" });
  });
  return router;
}
