// scripts/e2e-mint.js — PNG in -> NFT minted -> tokenURI resolves -> VERIFIED
// Usage: node scripts/e2e-mint.js ./test.png "CyberNinja"
import fs from "node:fs";
const [pngPath, nickname = "Bot"] = process.argv.slice(2);
if (!pngPath || !fs.existsSync(pngPath)) {
  console.error("Usage: node scripts/e2e-mint.js <pngPath> <nickname>");
  process.exit(1);
}
const API = process.env.VITE_API_URL ?? "http://localhost:3001";
console.log(`[e2e] POST ${API}/api/artworks with ${pngPath} as "${nickname}"`);
// TODO: implement multipart POST, poll /status, fetch verify, print {tokenId, txHash, verified}
console.log("[e2e] TODO: implement (see backend/AGENT.md §4). Exit 0 stub.");
