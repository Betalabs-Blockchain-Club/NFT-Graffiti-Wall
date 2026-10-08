import { createHash } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3001);
const adminToken = process.env.ADMIN_TOKEN ?? "mock-admin-token";
const colors = ["#fa6b4a", "#b2ef62", "#aa8cff", "#53d4d1", "#f6b74a", "#ee7db0"];
const starters = [
  ["wall-art-101", "Mira", "pending"],
  ["wall-art-102", "sprayday", "pending"],
  ["wall-art-103", "Kaito", "minted"],
  ["wall-art-104", "BlueFox", "minted"],
  ["wall-art-105", "orbit", "hidden"]
];
const records = new Map(starters.map(([id, nickname, status], index) => {
  const imageCID = `bafy-mock-${id}`;
  const item = {
    id,
    ...(status === "minted" ? { tokenId: index + 30 } : {}),
    nickname,
    imageCID,
    imageUrl: `/mock/ipfs/${imageCID}`,
    sha256: createHash("sha256").update(id).digest("hex"),
    status,
    createdAt: new Date(Date.now() - (index + 1) * 3_600_000).toISOString()
  };
  return [id, item];
}));

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  return req.headers.authorization === `Bearer ${adminToken}`;
}

function unauthorized(res) {
  sendJson(res, 401, { code: "unauthorized", message: "A valid admin bearer token is required." });
}

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
}

const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/gallery") {
    if (!authorized(req)) return unauthorized(res);
    const status = url.searchParams.get("status") ?? "approved";
    if (!["pending", "minted", "approved", "hidden"].includes(status)) return sendJson(res, 400, { code: "invalid-status", message: "Unknown gallery status." });
    const matches = [...records.values()].filter((item) => item.status === status);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 48) || 48, 1), 100);
    const offset = Math.max(Number(url.searchParams.get("cursor") ?? 0) || 0, 0);
    const items = matches.slice(offset, offset + limit).map((item) => ({ ...item }));
    const nextCursor = offset + items.length < matches.length ? String(offset + items.length) : null;
    return sendJson(res, 200, { items, nextCursor });
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/admin/artworks/")) {
    if (!authorized(req)) return unauthorized(res);
    const match = url.pathname.match(/^\/api\/admin\/artworks\/([^/]+)\/(approve|hide)$/);
    if (!match) return sendJson(res, 404, { code: "not-found", message: "Moderation route not found." });
    const id = decodeURIComponent(match[1]);
    const item = records.get(id);
    if (!item) return sendJson(res, 404, { code: "not-found", message: "Artwork not found." });
    item.status = match[2] === "hide" ? "hidden" : "approved";
    return sendJson(res, 200, { item: { ...item } });
  }

  if (req.method === "GET" && url.pathname.startsWith("/mock/ipfs/")) {
    const id = url.pathname.slice("/mock/ipfs/".length);
    const item = [...records.values()].find((record) => record.imageCID === id);
    if (!item) { res.writeHead(404); res.end("Not found"); return; }
    const color = colors[Number(item.id.slice(-1)) % colors.length];
    const safeNickname = escapeXml(item.nickname);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 520"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#211839"/></linearGradient></defs><rect width="720" height="520" fill="#12152c"/><path d="M34 372 180 115l90 164 98-138 186 231Z" fill="url(#g)"/><circle cx="520" cy="130" r="48" fill="#fff" opacity=".76"/><text x="42" y="468" fill="white" font-family="sans-serif" font-size="34" font-weight="700">${safeNickname}'s wall art</text></svg>`;
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" });
    res.end(svg);
    return;
  }

  sendJson(res, 404, { code: "not-found", message: "Route not found." });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Admin mock API listening on http://127.0.0.1:${port}`);
  console.log(`Fixture admin token: ${adminToken}`);
});

server.on("close", () => console.log("Admin mock API stopped."));
