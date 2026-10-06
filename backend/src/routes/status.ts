import { Router } from "express";
import type { createMintQueue } from "../services/queue.js";

type Queue = ReturnType<typeof createMintQueue>;

export function createStatusRouter(queue: Queue) {
  const router = Router();
  router.get("/:jobId/status", (req, res) => {
    const job = queue.getStatus(req.params.jobId);
    if (!job) return res.status(404).json({ code: "not_found", message: "Mint job not found" });
    return res.json(job);
  });
  return router;
}