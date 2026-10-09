import { createHash } from "node:crypto";
import cors from "cors";
import express, { type Request, type Response } from "express";
import multer from "multer";
import type { Server } from "socket.io";

type MockStage = "hashing" | "uploading" | "minting" | "confirmed" | "failed";
type MockStatus = "pending" | "minted" | "approved" | "hidden" | "failed";
type GalleryStatus = "pending" | "minted" | "approved" | "hidden";

type MockMintJob = {
  jobId: string;
  stage: MockStage;
  tokenId?: number;
  txHash?: string;
  imageCID?: string;
  error?: string;
};

type MockGalleryItem = {
  id: string;
  tokenId?: number;
  nickname: string;
  imageCID: string;
  imageUrl: string;
  sha256: string;
  status: Exclude<MockStatus, "failed">;
  createdAt: string;
};

type MockArtwork = {
  item: MockGalleryItem;
  bytes: Buffer;
  clientHash: string;
  job: MockMintJob;
  status: MockStatus;
};

type MockConfig = {
  MODERATION_MODE: "display_after_approve" | "mint_after_approve";
  KILL_SWITCH: boolean;
  IPFS_PROVIDER: "mock";
};

type MockApiOptions = {
  adminToken?: string;
  stageDelayMs?: number;
  now?: () => Date;
  idFactory?: () => string;
};

type SocketLike = {
  emit(event: string, payload: unknown): void;
  on(event: string, listener: (value: string) => void): void;
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 } });

function jsonError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ code, message });
}

function adminTokenFrom(req: Request): string | undefined {
  const value = req.header("Authorization");
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : undefined;
}

export function createMockApi(options: MockApiOptions = {}) {
  const adminToken = options.adminToken ?? "mock-admin-token";
  const stageDelayMs = options.stageDelayMs ?? 2_000;
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const router = express.Router();
  const artworks = new Map<string, MockArtwork>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const galleryListeners = new Set<(event: "new" | "hide" | "like-count", payload: unknown) => void>();
  const jobListeners = new Set<(job: MockMintJob) => void>();
  let nextTokenId = 1;
  let config: MockConfig = {
    MODERATION_MODE: "display_after_approve",
    KILL_SWITCH: false,
    IPFS_PROVIDER: "mock"
  };

  const schedule = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const emitJob = (job: MockMintJob) => {
    for (const listener of jobListeners) listener({ ...job });
  };

  const emitGallery = (event: "new" | "hide" | "like-count", payload: unknown) => {
    for (const listener of galleryListeners) listener(event, payload);
  };

  const requireAdmin = (req: Request, res: Response): boolean => {
    if (adminTokenFrom(req) !== adminToken) {
      jsonError(res, 401, "unauthorized", "A valid admin bearer token is required");
      return false;
    }
    return true;
  };

  const findArtwork = (id: string, res: Response): MockArtwork | undefined => {
    const artwork = artworks.get(id);
    if (!artwork) {
      jsonError(res, 404, "not_found", "Artwork not found");
      return undefined;
    }
    return artwork;
  };

  const advance = (artwork: MockArtwork, stage: MockStage) => {
    artwork.job.stage = stage;
    if (stage === "uploading") {
      artwork.job.imageCID = artwork.item.imageCID;
    }
    if (stage === "confirmed") {
      const tokenId = nextTokenId++;
      artwork.job.tokenId = tokenId;
      artwork.job.txHash = `0x${artwork.item.sha256.slice(0, 64)}`;
      artwork.item.tokenId = tokenId;
      artwork.status = "minted";
      artwork.item.status = "minted";
    }
    emitJob(artwork.job);
  };

  const startJob = (artwork: MockArtwork) => {
    (['hashing', 'uploading', 'minting', 'confirmed'] as MockStage[]).forEach((stage, index) => {
      schedule(() => advance(artwork, stage), stageDelayMs * (index + 1));
    });
  };

  const isPng = (bytes: Buffer) => bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.equals(bytes.subarray(0, PNG_SIGNATURE.length));

  router.use(cors());

  router.post("/api/artworks", upload.single("image"), (req, res) => {
    if (config.KILL_SWITCH) return jsonError(res, 503, "kill-switch", "Minting is temporarily disabled");
    const file = (req as Request & { file?: { buffer: Buffer } }).file;
    if (!file) return jsonError(res, 400, "missing-image", "A PNG image is required");
    if (!isPng(file.buffer)) return jsonError(res, 400, "not-png", "The image must be a PNG");

    const nickname = String(req.body.nickname ?? "").trim();
    const clientHash = String(req.body.clientHash ?? "").toLowerCase();
    if (nickname.length < 1 || nickname.length > 32) return jsonError(res, 400, "invalid-nickname", "Nickname must be 1-32 characters");
    if (!/^[a-f0-9]{64}$/.test(clientHash)) return jsonError(res, 400, "invalid-hash", "clientHash must be a SHA-256 hex string");

    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    if (sha256 !== clientHash) return jsonError(res, 400, "hash-mismatch", "clientHash does not match the uploaded bytes");

    const jobId = idFactory();
    const imageCID = `bafy-mock-${sha256.slice(0, 24)}`;
    const item: MockGalleryItem = {
      id: jobId,
      nickname,
      imageCID,
      imageUrl: `/mock/ipfs/${imageCID}`,
      sha256,
      status: "pending",
      createdAt: now().toISOString()
    };
    const artwork: MockArtwork = {
      item,
      bytes: file.buffer,
      clientHash,
      job: { jobId, stage: "hashing" },
      status: "pending"
    };
    artworks.set(jobId, artwork);
    emitJob(artwork.job);
    startJob(artwork);

    return res.status(202).json({ jobId, status: "pending" });
  });

  router.get("/api/artworks/:jobId/status", (req, res) => {
    const artwork = findArtwork(req.params.jobId, res);
    return artwork ? res.json(artwork.job) : undefined;
  });

  router.get("/api/admin/artworks/:id/certificate", (req, res) => {
    if (!requireAdmin(req, res)) return undefined;
    const artwork = findArtwork(req.params.id, res);
    if (!artwork) return undefined;
    if (artwork.item.tokenId == null) return jsonError(res, 404, "not-found", "Minted artwork certificate data not found");
    return res.json({ txHash: artwork.job.txHash ?? `0x${artwork.item.sha256}`, mintedAt: artwork.item.createdAt });
  });

  router.get("/api/gallery", (req, res) => {
    const status = String(req.query.status ?? "approved") as GalleryStatus;
    if (!["pending", "minted", "approved", "hidden"].includes(status)) {
      return jsonError(res, 400, "invalid-status", "Unknown gallery status");
    }
    if (status !== "approved" && !requireAdmin(req, res)) return undefined;

    const limit = Math.min(Math.max(Number(req.query.limit ?? 48) || 48, 1), 100);
    const start = Math.max(Number(req.query.cursor ?? 0) || 0, 0);
    const items = [...artworks.values()]
      .filter((artwork) => artwork.status === status)
      .slice(start, start + limit)
      .map((artwork) => ({ ...artwork.item }));
    const nextCursor = start + items.length < [...artworks.values()].filter((artwork) => artwork.status === status).length
      ? String(start + items.length)
      : null;
    return res.json({ items, nextCursor });
  });

  // Serve the exact uploaded PNG bytes for the mock IPFS image URL exposed in gallery items.
  router.get("/mock/ipfs/:cid", (req, res) => {
    const artwork = [...artworks.values()].find((entry) => entry.item.imageCID === req.params.cid);
    if (!artwork) return jsonError(res, 404, "not_found", "Image not found");
    res.type("png").send(artwork.bytes);
  });

  router.post("/api/admin/artworks/:id/approve", (req, res) => {
    if (!requireAdmin(req, res)) return undefined;
    const artwork = findArtwork(req.params.id, res);
    if (!artwork) return undefined;
    artwork.status = "approved";
    artwork.item.status = "approved";
    emitGallery("new", { ...artwork.item });
    return res.json({ item: { ...artwork.item } });
  });

  router.post("/api/admin/artworks/:id/hide", (req, res) => {
    if (!requireAdmin(req, res)) return undefined;
    const artwork = findArtwork(req.params.id, res);
    if (!artwork) return undefined;
    artwork.status = "hidden";
    artwork.item.status = "hidden";
    emitGallery("hide", { id: artwork.item.id });
    return res.json({ item: { ...artwork.item } });
  });

  router.post("/api/admin/artworks/:id/archive", (req, res) => {
    if (!requireAdmin(req, res)) return undefined;
    const artwork = findArtwork(req.params.id, res);
    if (!artwork) return undefined;
    if (artwork.status !== "approved") return jsonError(res, 409, "not-ready", "Only published artwork can be removed from the gallery");
    artworks.delete(req.params.id);
    emitGallery("hide", { id: req.params.id });
    return res.json({ ok: true, archiveId: `mock-archive-${Date.now()}`, artworkCount: 1, voteCount: 0 });
  });

  router.put("/api/admin/config", (req, res) => {
    if (!requireAdmin(req, res)) return undefined;
    if (req.body.MODERATION_MODE !== undefined) config.MODERATION_MODE = req.body.MODERATION_MODE;
    if (req.body.KILL_SWITCH !== undefined) config.KILL_SWITCH = Boolean(req.body.KILL_SWITCH);
    if (req.body.IPFS_PROVIDER !== undefined) config.IPFS_PROVIDER = "mock";
    return res.json({ ...config });
  });

  router.post("/api/admin/reset", (req, res) => {
    if (!requireAdmin(req, res)) return undefined;
    if (!/^ARCHIVE \d{4}-\d{2}-\d{2}$/.test(String(req.body.confirm ?? ""))) {
      return jsonError(res, 400, "invalid-confirmation", "Exact archive confirmation is required");
    }
    let archived = 0;
    for (const artwork of artworks.values()) {
      if (artwork.status !== "hidden") {
        artwork.status = "hidden";
        artwork.item.status = "hidden";
        archived += 1;
      }
    }
    return res.json({ ok: true, archived });
  });

  const likes = new Set<string>();
  const browserIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  router.get("/api/likes", (req, res) => {
    const browserId = String(req.query.browserId ?? "").toLowerCase();
    if (!browserIdPattern.test(browserId)) return jsonError(res, 400, "invalid-input", "browserId must be a UUID v4");
    const items = [...artworks.values()].filter((artwork) => artwork.status === "approved").map((artwork) => {
      const prefix = `${artwork.item.id}|`;
      const keys = [...likes].filter((key) => key.startsWith(prefix));
      return { artworkId: artwork.item.id, likes: keys.length, likedByMe: likes.has(`${artwork.item.id}|${browserId}`) };
    });
    return res.json({ items });
  });
  router.post("/api/likes", (req, res) => {
    const artworkId = typeof req.body?.artworkId === "string" ? req.body.artworkId.trim() : "";
    const browserId = typeof req.body?.browserId === "string" ? req.body.browserId.toLowerCase() : "";
    const liked = req.body?.liked;
    if (!artworkId || artworkId.length > 128 || !browserIdPattern.test(browserId) || typeof liked !== "boolean") {
      return jsonError(res, 400, "invalid-input", "Like requires artworkId, a UUID v4 browserId, and a boolean liked value");
    }
    const artwork = artworks.get(artworkId);
    if (!artwork || artwork.status !== "approved") return jsonError(res, 404, "not-found", "Artwork is not available for liking");
    const key = `${artworkId}|${browserId}`;
    if (liked) likes.add(key); else likes.delete(key);
    const count = [...likes].filter((entry) => entry.startsWith(`${artworkId}|`)).length;
    emitGallery("like-count", { artworkId, likes: count });
    return res.json({ artworkId, likes: count, likedByMe: liked });
  });

  const votes = new Set<string>();
  router.post("/api/votes", (req, res) => {
    const artworkId = String(req.body.artworkId ?? "");
    const category = String(req.body.category ?? "best");
    const voterKey = String(req.body.voterKey ?? "");
    const key = `${artworkId}\u0000${category}\u0000${voterKey}`;
    if (votes.has(key)) return jsonError(res, 409, "duplicate-vote", "Vote already recorded");
    votes.add(key);
    return res.status(201).json({ ok: true });
  });

  router.get("/api/leaderboard", (_req, res) => {
    const counts = new Map<string, number>();
    for (const key of votes) {
      const [artworkId, category] = key.split("\u0000");
      const countKey = `${artworkId}\u0000${category}`;
      counts.set(countKey, (counts.get(countKey) ?? 0) + 1);
    }
    return res.json([...counts].map(([key, voteCount]) => {
      const [artworkId, category] = key.split("\u0000");
      return { artworkId, category, votes: voteCount };
    }));
  });

  router.get("/api/health", (_req, res) => {
    res.json({ ok: true, chain: "mock", ipfs: "mock", queueDepth: 0, balanceEth: 100 });
  });

  const attachRealtime = (io: Server) => {
    const gallery = io.of("/gallery");
    const status = io.of("/status");
    const subscriptions = new Map<SocketLike, Set<string>>();

    const galleryListener = (event: "new" | "hide" | "like-count", payload: unknown) => gallery.emit(event, payload);
    const jobListener = (job: MockMintJob) => {
      for (const [socket, jobs] of subscriptions) {
        if (jobs.has(job.jobId)) socket.emit("job", { ...job });
      }
    };
    galleryListeners.add(galleryListener);
    jobListeners.add(jobListener);

    gallery.on("connection", (socket: SocketLike) => {
      void socket;
    });
    status.on("connection", (socket: SocketLike) => {
      const jobs = new Set<string>();
      subscriptions.set(socket, jobs);
      socket.on("subscribe", (jobId) => {
        jobs.add(jobId);
        const artwork = artworks.get(jobId);
        if (artwork) socket.emit("job", { ...artwork.job });
      });
    });

    return () => {
      galleryListeners.delete(galleryListener);
      jobListeners.delete(jobListener);
      subscriptions.clear();
    };
  };

  const close = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    artworks.clear();
  };

  return { router, attachRealtime, close, getArtwork: (id: string) => artworks.get(id) };
}

export type MockApi = ReturnType<typeof createMockApi>;
