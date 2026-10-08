// scripts/test/mock-api.mjs — lightweight mock of the backend REST API.
// Usage: node scripts/test/mock-api.mjs [port]
// Env:   RPC_URL, CONTRACT_ADDRESS — when set, actually mints on the Hardhat node
//        so that e2e-mint.js can call verify() against a real on-chain record.
//        Without them the mock still walks through stages (useful for unit tests
//        that only check the polling / exit-code logic).
import http from "node:http";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");
dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

const PORT         = Number(process.argv[2] ?? 3001);
const RPC_URL      = process.env.RPC_URL      ?? "http://127.0.0.1:8545";
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS ?? process.env.VITE_CONTRACT_ADDRESS ?? "";

const MINT_ABI = [
  "function mint(address to, string calldata nickname, string calldata ipfsCID, bytes32 artworkHash, string calldata metadataURI) external returns (uint256)",
];

// Lazy-load ethers only when we need to mint on-chain
let minterWallet = null;
async function getMinter() {
  if (minterWallet) return minterWallet;
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  // Hardhat default account 0 has MINTER_ROLE (it deployed the contract)
  const accounts = await provider.listAccounts();
  minterWallet = await provider.getSigner(accounts[0].address);
  return minterWallet;
}

async function mintOnChain(nickname, clientHashHex) {
  const { ethers } = await import("ethers");
  const signer = await getMinter();
  const contract = new ethers.Contract(CONTRACT_ADDR, MINT_ABI, signer);
  const hashBytes32 = "0x" + clientHashHex;
  const fakeCID = "bafybeimock" + crypto.randomBytes(8).toString("hex");
  const fakeURI = `ipfs://${fakeCID}/metadata.json`;
  const tx = await contract.mint(await signer.getAddress(), nickname, fakeCID, hashBytes32, fakeURI);
  const receipt = await tx.wait();
  // tokenId is emitted in ArtworkMinted(tokenId, ...) — log topic[1]
  const tokenId = Number(receipt.logs[receipt.logs.length - 1].topics[1]);
  return { txHash: receipt.hash, imageCID: fakeCID, tokenId };
}

// In-memory job store
const jobs = new Map();
const STAGES = ["hashing", "uploading", "minting", "confirmed"];

async function advance(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  const idx = STAGES.indexOf(job.stage);
  if (idx >= STAGES.length - 1) return;
  const next = STAGES[idx + 1];

  if (next === "confirmed") {
    // Stay on "minting" until the on-chain tx resolves, then flip to confirmed.
    if (CONTRACT_ADDR) {
      try {
        const result = await mintOnChain(job.nickname, job.clientHash);
        job.tokenId  = result.tokenId;
        job.txHash   = result.txHash;
        job.imageCID = result.imageCID;
        job.stage    = "confirmed";
        console.log(`[mock-api] minted tokenId=${job.tokenId} txHash=${job.txHash}`);
      } catch (err) {
        console.error("[mock-api] on-chain mint failed:", err.message);
        job.stage = "failed";
        job.error = err.message;
      }
    } else {
      job.txHash   = "0x" + crypto.randomBytes(32).toString("hex");
      job.imageCID = "bafybeimock" + crypto.randomBytes(8).toString("hex");
      job.stage    = "confirmed";
    }
    return;
  }

  job.stage = next;
  setTimeout(() => advance(jobId), 600);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function extractField(body, boundary, name) {
  const needle = Buffer.from(`name="${name}"\r\n\r\n`);
  const idx = body.indexOf(needle);
  if (idx === -1) return null;
  const start = idx + needle.length;
  const end = body.indexOf(Buffer.from(`\r\n--${boundary}`), start);
  return body.slice(start, end).toString("utf8");
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (req.method === "POST" && p === "/api/artworks") {
    const rawBody = await parseBody(req);
    const ct = req.headers["content-type"] ?? "";
    const m = ct.match(/boundary=(.+)/);
    const clientHash = m ? extractField(rawBody, m[1], "clientHash") : null;
    const nickname   = (m ? extractField(rawBody, m[1], "nickname") : null) ?? "mock";

    const jobId = crypto.randomUUID();
    jobs.set(jobId, { stage: "hashing", clientHash, nickname, tokenId: null, txHash: null, imageCID: null });
    setTimeout(() => advance(jobId), 600);
    return send(res, 202, { jobId, status: "pending" });
  }

  const statusMatch = p.match(/^\/api\/artworks\/([^/]+)\/status$/);
  if (req.method === "GET" && statusMatch) {
    const job = jobs.get(statusMatch[1]);
    if (!job) return send(res, 404, { error: "not found" });
    return send(res, 200, {
      jobId: statusMatch[1],
      stage: job.stage,
      ...(job.tokenId  != null && { tokenId: job.tokenId }),
      ...(job.txHash   != null && { txHash: job.txHash }),
      ...(job.imageCID != null && { imageCID: job.imageCID }),
      ...(job.error    != null && { error: job.error }),
    });
  }

  if (req.method === "GET" && p === "/api/health") {
    return send(res, 200, { ok: true, chain: CONTRACT_ADDR ? "hardhat" : "mock", ipfs: "mock", queueDepth: 0 });
  }

  send(res, 404, { error: `mock: no route for ${req.method} ${p}` });
});

server.listen(PORT, () => {
  console.log(`[mock-api] listening on :${PORT}  contract=${CONTRACT_ADDR || "(none, offline mode)"}`);
});
