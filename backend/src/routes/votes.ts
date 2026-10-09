import { createHmac } from "node:crypto";
import { Router } from "express";
import { route } from "../db/http.js";
import { StorageError } from "../db/errors.js";
import type { Storage } from "../services/storage.js";
import { z } from "zod";

const BrowserIdSchema = z.string().uuid().refine((value) => {
  const [version, variant] = value.split("-").slice(2, 4);
  return version?.[0] === "4" && /^[89ab]$/i.test(variant?.[0] ?? "");
}, "browserId must be a UUID v4");
const LikeSchema = z.object({
  artworkId: z.string().trim().min(1).max(128),
  browserId: BrowserIdSchema,
  liked: z.boolean()
}).strict();

export function createVotesRouter({ storage, onLikeCount, likeRateLimitPerMinute = 60, rateLimitSecret = "local-rate-limit-secret" }: {
  storage: Storage;
  onLikeCount?: (event: { artworkId: string; likes: number }) => void;
  likeRateLimitPerMinute?: number;
  rateLimitSecret?: string;
}): Router {
  const router = Router();
  const requestLimit = async (scope: string, identity: string, limit: number, res: import("express").Response) => {
    const bucketKey = createHmac("sha256", rateLimitSecret).update(`${scope}:${identity}`).digest("hex");
    const result = await storage.consumeRateLimit(bucketKey, limit);
    if (result.allowed) return;
    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    throw new StorageError("rate-limit", "Too many requests. Try again later.", 429);
  };

  router.get("/api/likes", route(async (req, res) => {
    await requestLimit("likes:read:ip", req.ip || "unknown", likeRateLimitPerMinute * 20, res);
    const parsed = BrowserIdSchema.safeParse(req.query.browserId);
    if (!parsed.success) throw new StorageError("invalid-input", "browserId must be a UUID v4");
    res.setHeader("Cache-Control", "no-store");
    const items = (await storage.likeSummary(parsed.data)).map((entry) => ({ ...entry, likedByMe: Boolean(entry.likedByMe) }));
    res.json({ items });
  }));

  router.post("/api/likes", route(async (req, res) => {
    await requestLimit("likes:write:ip", req.ip || "unknown", likeRateLimitPerMinute * 10, res);
    const parsed = LikeSchema.safeParse(req.body);
    if (!parsed.success) throw new StorageError("invalid-input", "Like requires artworkId, a UUID v4 browserId, and a boolean liked value");
    await requestLimit("likes:write:browser", parsed.data.browserId.toLowerCase(), likeRateLimitPerMinute, res);
    const result = await storage.setLike(parsed.data);
    onLikeCount?.({ artworkId: result.artworkId, likes: result.likes });
    res.json(result);
  }));

  router.post("/api/votes", route(async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      throw new StorageError("invalid-input", "Vote body is required");
    }
    if (req.body.category === "like") throw new StorageError("invalid-input", "Use the likes endpoint for gallery likes");
    await storage.addVote({ artworkId: req.body.artworkId, category: req.body.category, voterKey: req.body.voterKey });
    res.status(201).json({ ok: true });
  }));
  router.get("/api/leaderboard", route(async (_req, res) => res.json(await storage.leaderboard())));
  return router;
}
