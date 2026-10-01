import express from "express";

export const artworksRouter = express.Router();

// POST /api/artworks — {image (multipart PNG), nickname, clientHash} -> {jobId, status}
// TODO: validate PNG magic + size ≤ MAX_IMAGE_KB, recompute SHA-256, reject mismatch 400,
//       enqueue {jobId, bytes, nickname}, return 202.
artworksRouter.post("/", (req, res) => res.status(501).json({ error: "not implemented" }));

// GET /api/artworks/:id/status -> {jobId, stage, tokenId?, txHash?, imageCID?, error?}
artworksRouter.get("/:id/status", (req, res) => res.status(501).json({ error: "not implemented" }));
