import { Router } from "express";
import { route } from "../db/http.js";
import { StorageError } from "../db/errors.js";
import type { Storage } from "../services/storage.js";

export function createVotesRouter({ storage }: { storage: Storage }): Router {
  const router = Router();
  router.post("/api/votes", route((req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      throw new StorageError("invalid-input", "Vote body is required");
    }
    storage.addVote({ artworkId: req.body.artworkId, category: req.body.category, voterKey: req.body.voterKey });
    res.status(201).json({ ok: true });
  }));
  router.get("/api/leaderboard", route((_req, res) => res.json(storage.leaderboard())));
  return router;
}
