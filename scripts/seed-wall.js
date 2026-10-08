// scripts/seed-wall.js — generate n procedural PNGs, mint each, then approve
// Usage: node scripts/seed-wall.js [n=10]
// Env:   API_URL, ADMIN_TOKEN (reads .env if present)
import crypto from "node:crypto";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("dotenv").config({ path: new URL("../.env", import.meta.url).pathname });

const deflate = promisify(zlib.deflate);

const API_URL    = process.env.API_URL    ?? process.env.VITE_API_URL ?? "http://localhost:3001";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const POLL_MS    = Number(process.env.POLL_MS    ?? 1500);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 120_000);

const N = Number(process.argv[2] ?? 10);
if (Number.isNaN(N) || N < 1) { console.error("n must be a positive integer"); process.exit(1); }

// ── PNG generation ────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0);
  return Buffer.concat([len, type, data, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) | 0;
}

const NAMES = [
  "Pixel Phoenix","Neon Ghost","Chrome Wave","Acid Rain","Static Dreamer",
  "Void Walker","Data Surge","Grid Phantom","Signal Echo","Byte Rider",
  "Plasma Fox","Glitch Monk","Turbo Nova","Iron Sprite","Cyber Bloom",
];

async function makePng(seed) {
  const W = 32, H = 32;
  // deterministic palette from seed
  const r1 = (seed * 137 + 11) & 0xff;
  const g1 = (seed * 211 + 53) & 0xff;
  const b1 = (seed * 79  + 97) & 0xff;
  const r2 = (r1 + 128) & 0xff;
  const g2 = (g1 + 64)  & 0xff;
  const b2 = (b1 + 192) & 0xff;

  // scanlines: filter byte 0x00 + RGB pixels
  const rows = [];
  for (let y = 0; y < H; y++) {
    const row = [0x00]; // filter none
    for (let x = 0; x < W; x++) {
      const t = ((x ^ y ^ seed) & 3);
      row.push(t < 2 ? r1 : r2, t < 2 ? g1 : g2, t < 2 ? b1 : b2);
    }
    rows.push(Buffer.from(row));
  }

  const raw = Buffer.concat(rows);
  const idat = await deflate(raw, { level: 6 });

  const sig  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = pngChunk(Buffer.from("IHDR"), (() => {
    const b = Buffer.alloc(13);
    b.writeUInt32BE(W, 0); b.writeUInt32BE(H, 4);
    b[8] = 8; b[9] = 2; // 8-bit RGB
    return b;
  })());
  const idatChunk = pngChunk(Buffer.from("IDAT"), idat);
  const iend = pngChunk(Buffer.from("IEND"), Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idatChunk, iend]);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function fail(msg) { console.error(`[seed] ✗ ${msg}`); process.exit(1); }

async function apiFetch(path, opts = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, opts);
  } catch (err) {
    if (err.cause?.code === "ECONNREFUSED") fail(`API unreachable at ${API_URL}`);
    throw err;
  }
  return res;
}

async function postArtwork(pngBuf, nickname, clientHash, index) {
  const boundary = `----seedBoundary${index}x${Date.now()}`;
  const deviceId = `seed-${crypto.randomUUID()}`;

  const part = (name, value, filename, ct) => {
    let h = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"`;
    if (filename) h += `; filename="${filename}"`;
    if (ct) h += `\r\nContent-Type: ${ct}`;
    h += "\r\n\r\n";
    return [Buffer.from(h), typeof value === "string" ? Buffer.from(value) : value, Buffer.from("\r\n")];
  };

  const body = Buffer.concat([
    ...part("image", pngBuf, `seed-${index}.png`, "image/png"),
    ...part("nickname", nickname),
    ...part("clientHash", clientHash),
    Buffer.from(`--${boundary}--\r\n`),
  ]);

  const res = await apiFetch("/api/artworks", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "X-Device-Id": deviceId,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    fail(`POST /api/artworks → ${res.status}: ${text}`);
  }
  return res.json();
}

async function pollStatus(jobId) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await apiFetch(`/api/artworks/${jobId}/status`);
    if (!res.ok) fail(`GET /api/artworks/${jobId}/status → ${res.status}`);
    const job = await res.json();
    process.stdout.write(`  stage=${job.stage}  \r`);
    if (job.stage === "confirmed") { process.stdout.write("\n"); return job; }
    if (job.stage === "failed")    fail(`Job ${jobId} failed: ${job.error ?? "unknown"}`);
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  fail(`Timed out waiting for ${jobId}`);
}

async function approve(jobId) {
  if (!ADMIN_TOKEN) fail("ADMIN_TOKEN not set — cannot approve");
  const res = await apiFetch(`/api/admin/artworks/${jobId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  if (res.status === 401 || res.status === 403) fail("ADMIN_TOKEN rejected (401/403)");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    fail(`POST /api/admin/artworks/${jobId}/approve → ${res.status}: ${text}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
console.log(`[seed] seeding ${N} artwork(s) → ${API_URL}`);
const results = [];

for (let i = 1; i <= N; i++) {
  const nickname = NAMES[(i - 1) % NAMES.length];
  const pngBuf   = await makePng(i);
  const clientHash = crypto.createHash("sha256").update(pngBuf).digest("hex");

  console.log(`[seed] (${i}/${N}) "${nickname}"`);

  const { jobId } = await postArtwork(pngBuf, nickname, clientHash, i);
  const job = await pollStatus(jobId);
  await approve(jobId);

  results.push({ jobId, nickname, tokenId: job.tokenId, txHash: job.txHash, imageCID: job.imageCID });
  console.log(`  ✓ approved  tokenId=${job.tokenId ?? "pending"}`);
}

console.log(`\n[seed] done — ${N} artwork(s) seeded and approved`);
console.table(results);
