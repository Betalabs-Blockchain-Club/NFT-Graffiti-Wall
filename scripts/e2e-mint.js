// scripts/e2e-mint.js — PNG in -> NFT minted -> tokenId on-chain -> VERIFIED
// Usage: node scripts/e2e-mint.js <pngPath> <nickname>
// Env:   API_URL (default http://localhost:3001)
//        RPC_URL (default http://localhost:8545)
//        CONTRACT_ADDRESS
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

const { ethers } = await import("ethers");

// ── config ──────────────────────────────────────────────────────────────────
const API_URL      = process.env.API_URL      ?? process.env.VITE_API_URL ?? "http://localhost:3001";
const RPC_URL      = process.env.RPC_URL      ?? "http://localhost:8545";
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS ?? process.env.VITE_CONTRACT_ADDRESS ?? "";
const POLL_MS      = Number(process.env.POLL_MS  ?? 2000);
const TIMEOUT_MS   = Number(process.env.TIMEOUT_MS ?? 120_000);

const VERIFY_ABI = [
  "function verify(uint256 id, bytes32 candidateHash) external view returns (bool)",
  "function artworks(uint256) external view returns (address creator, string nickname, string ipfsCID, bytes32 artworkHash, uint64 timestamp)",
];

// ── helpers ──────────────────────────────────────────────────────────────────
function fail(msg) {
  console.error(`[e2e] ✗ ${msg}`);
  process.exit(1);
}

function sha256hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function postArtwork(pngBuf, nickname, clientHash) {
  const boundary = `----e2eBoundary${Date.now()}`;
  const deviceId = `e2e-${crypto.randomUUID()}`;

  const part = (name, value, filename, contentType) => {
    let h = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"`;
    if (filename) h += `; filename="${filename}"`;
    if (contentType) h += `\r\nContent-Type: ${contentType}`;
    h += "\r\n\r\n";
    return [Buffer.from(h), typeof value === "string" ? Buffer.from(value) : value, Buffer.from("\r\n")];
  };

  const body = Buffer.concat([
    ...part("image", pngBuf, path.basename(pngPath), "image/png"),
    ...part("nickname", nickname),
    ...part("clientHash", clientHash),
    Buffer.from(`--${boundary}--\r\n`),
  ]);

  const res = await fetch(`${API_URL}/api/artworks`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "X-Device-Id": deviceId,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    fail(`POST /api/artworks returned ${res.status}: ${text}`);
  }
  return res.json();
}

async function pollStatus(jobId) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await fetch(`${API_URL}/api/artworks/${jobId}/status`);
    if (!res.ok) fail(`GET /api/artworks/${jobId}/status returned ${res.status}`);
    const job = await res.json();
    const { stage, tokenId, txHash, imageCID, error } = job;
    process.stdout.write(`[e2e] stage=${stage}\r`);
    if (stage === "confirmed") {
      console.log();
      return { tokenId, txHash, imageCID };
    }
    if (stage === "failed") fail(`Job failed: ${error ?? "unknown"}`);
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  fail(`Timed out after ${TIMEOUT_MS / 1000}s waiting for confirmation`);
}

async function verifyOnChain(tokenId, clientHashHex) {
  if (!CONTRACT_ADDR) fail("CONTRACT_ADDRESS not set");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDR, VERIFY_ABI, provider);
  const hashBytes32 = "0x" + clientHashHex;
  const ok = await contract.verify(tokenId, hashBytes32);
  return ok;
}

// ── main ──────────────────────────────────────────────────────────────────────
const [pngPath, nickname = "Bot"] = process.argv.slice(2);

if (!pngPath) {
  console.error("Usage: node scripts/e2e-mint.js <pngPath> <nickname>");
  process.exit(1);
}
if (!fs.existsSync(pngPath)) fail(`File not found: ${pngPath}`);

const pngBuf = fs.readFileSync(pngPath);
const clientHash = sha256hex(pngBuf);
console.log(`[e2e] hash=${clientHash}`);
console.log(`[e2e] POST ${API_URL}/api/artworks  nickname="${nickname}"`);

let jobId;
try {
  const resp = await postArtwork(pngBuf, nickname, clientHash);
  jobId = resp.jobId;
  if (!jobId) fail(`No jobId in response: ${JSON.stringify(resp)}`);
} catch (err) {
  if (err.cause?.code === "ECONNREFUSED") fail(`API unreachable at ${API_URL}`);
  throw err;
}
console.log(`[e2e] jobId=${jobId}`);

const { tokenId, txHash, imageCID } = await pollStatus(jobId);
if (!tokenId) fail("confirmed but tokenId missing");

console.log(`[e2e] tokenId=${tokenId}  txHash=${txHash}`);

let verified = false;
try {
  verified = await verifyOnChain(tokenId, clientHash);
} catch (err) {
  fail(`verify() call failed: ${err.message}`);
}

if (!verified) fail(`Hash mismatch: on-chain hash does not match clientHash ${clientHash}`);

console.log(JSON.stringify({ jobId, imageCID, tokenId, txHash, verified }, null, 2));
console.log("[e2e] ✓ VERIFIED");
