// scripts/test/seed-mock.mjs — standalone mock for testing seed-wall.js and export-data.js
// Usage: node scripts/test/seed-mock.mjs [port]
// Supports: POST /api/artworks, GET /api/artworks/:jobId/status,
//           POST /api/admin/artworks/:id/approve|hide, GET /api/gallery, GET /api/health
import http from "node:http";
import crypto from "node:crypto";

const PORT       = Number(process.argv[2] ?? 3001);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "test-admin-token";

const jobs    = new Map(); // jobId -> job
const artworks = new Map(); // jobId -> GalleryItem

const STAGES = ["hashing", "uploading", "minting", "confirmed"];

function advanceLater(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  const idx = STAGES.indexOf(job.stage);
  if (idx >= STAGES.length - 1) return;
  setTimeout(() => {
    const j = jobs.get(jobId);
    if (!j) return;
    const ni = STAGES.indexOf(j.stage) + 1;
    j.stage = STAGES[ni];
    if (j.stage === "confirmed") {
      j.tokenId  = ++tokenCounter;
      j.txHash   = "0x" + crypto.randomBytes(32).toString("hex");
      j.imageCID = "bafybeiseed" + crypto.randomBytes(8).toString("hex");
      // also write into artworks gallery
      artworks.set(jobId, {
        id: jobId,
        tokenId: j.tokenId,
        nickname: j.nickname,
        imageCID: j.imageCID,
        imageUrl: `http://localhost:${PORT}/ipfs/${j.imageCID}`,
        sha256: j.clientHash,
        status: "minted",
        createdAt: new Date().toISOString(),
      });
    } else {
      advanceLater(jobId);
    }
  }, 400);
}

let tokenCounter = 0;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function extractField(body, boundary, name) {
  const needle = Buffer.from(`name="${name}"\r\n\r\n`);
  const idx = body.indexOf(needle);
  if (idx === -1) return null;
  const start = idx + needle.length;
  const end   = body.indexOf(Buffer.from(`\r\n--${boundary}`), start);
  return body.slice(start, end).toString("utf8");
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

function checkAdmin(req, res) {
  const auth = req.headers["authorization"] ?? "";
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    send(res, 401, { error: "unauthorized" });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p   = url.pathname;

  // POST /api/artworks
  if (req.method === "POST" && p === "/api/artworks") {
    const body = await parseBody(req);
    const ct   = req.headers["content-type"] ?? "";
    const m    = ct.match(/boundary=(.+)/);
    const clientHash = m ? extractField(body, m[1], "clientHash") : "";
    const nickname   = (m ? extractField(body, m[1], "nickname")  : null) ?? "seed";
    const jobId = crypto.randomUUID();
    jobs.set(jobId, { stage: "hashing", clientHash, nickname, tokenId: null, txHash: null, imageCID: null });
    advanceLater(jobId);
    return send(res, 202, { jobId, status: "pending" });
  }

  // GET /api/artworks/:jobId/status
  const statusMatch = p.match(/^\/api\/artworks\/([^/]+)\/status$/);
  if (req.method === "GET" && statusMatch) {
    const job = jobs.get(statusMatch[1]);
    if (!job) return send(res, 404, { error: "not found" });
    return send(res, 200, {
      jobId: statusMatch[1],
      stage: job.stage,
      ...(job.tokenId  != null && { tokenId:  job.tokenId }),
      ...(job.txHash   != null && { txHash:   job.txHash }),
      ...(job.imageCID != null && { imageCID: job.imageCID }),
    });
  }

  // POST /api/admin/artworks/:id/approve|hide
  const adminMatch = p.match(/^\/api\/admin\/artworks\/([^/]+)\/(approve|hide)$/);
  if (req.method === "POST" && adminMatch) {
    if (!checkAdmin(req, res)) return;
    const item = artworks.get(adminMatch[1]);
    if (!item) return send(res, 404, { error: "not found" });
    item.status = adminMatch[2] === "approve" ? "approved" : "hidden";
    return send(res, 200, { ok: true, id: adminMatch[1], status: item.status });
  }

  // GET /api/gallery
  if (req.method === "GET" && p === "/api/gallery") {
    const status = url.searchParams.get("status") ?? "approved";
    const limit  = Number(url.searchParams.get("limit") ?? 48);
    const cursor = url.searchParams.get("cursor");
    if (status !== "approved" && !checkAdmin(req, res)) return;
    let all = [...artworks.values()].filter(a => a.status === status);
    const startIdx = cursor ? all.findIndex(a => a.id === cursor) + 1 : 0;
    const page = all.slice(startIdx, startIdx + limit);
    const nextCursor = startIdx + limit < all.length ? page[page.length - 1]?.id : null;
    return send(res, 200, { items: page, nextCursor });
  }

  // GET /api/health
  if (req.method === "GET" && p === "/api/health") {
    return send(res, 200, { ok: true, chain: "mock", ipfs: "mock", queueDepth: jobs.size });
  }

  send(res, 404, { error: `mock: no route ${req.method} ${p}` });
});

server.listen(PORT, () => {
  console.log(`[seed-mock] listening on :${PORT}  ADMIN_TOKEN="${ADMIN_TOKEN}"`);
});
