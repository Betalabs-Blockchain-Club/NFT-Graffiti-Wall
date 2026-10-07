// scripts/export-data.js — dump all artworks to exports/YYYY-MM-DD.json + .csv
// Usage: node scripts/export-data.js
// Env:   API_URL, ADMIN_TOKEN (reads .env if present)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("dotenv").config({ path: new URL("../.env", import.meta.url).pathname });

const API_URL     = process.env.API_URL     ?? process.env.VITE_API_URL ?? "http://localhost:3001";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

const STATUSES = ["pending", "minting", "minted", "approved", "hidden", "failed"];
const CSV_FIELDS = ["id", "tokenId", "nickname", "imageCID", "sha256", "status", "createdAt", "imageUrl"];

function fail(msg) { console.error(`[export] ✗ ${msg}`); process.exit(1); }

async function fetchPage(status, cursor) {
  const params = new URLSearchParams({ status, limit: "100" });
  if (cursor) params.set("cursor", cursor);
  let res;
  try {
    res = await fetch(`${API_URL}/api/gallery?${params}`, {
      headers: ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {},
    });
  } catch (err) {
    if (err.cause?.code === "ECONNREFUSED") fail(`API unreachable at ${API_URL}`);
    throw err;
  }
  if (res.status === 401 || res.status === 403) fail("ADMIN_TOKEN rejected (401/403) — set ADMIN_TOKEN env var");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    fail(`GET /api/gallery?status=${status} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchAll() {
  const seen = new Set();
  const items = [];
  for (const status of STATUSES) {
    let cursor = undefined;
    while (true) {
      const page = await fetchPage(status, cursor);
      for (const item of (page.items ?? [])) {
        if (!seen.has(item.id)) { seen.add(item.id); items.push(item); }
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  }
  return items;
}

function toCSV(items) {
  const esc = v => (v == null ? "" : String(v).includes(",") ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const lines = [CSV_FIELDS.join(",")];
  for (const item of items) lines.push(CSV_FIELDS.map(f => esc(item[f])).join(","));
  return lines.join("\n") + "\n";
}

// ── main ──────────────────────────────────────────────────────────────────────
console.log(`[export] fetching all artworks from ${API_URL}`);

const items = await fetchAll();
console.log(`[export] fetched ${items.length} item(s)`);

if (items.length === 0) {
  console.log("[export] nothing to export");
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const dir   = new URL("../exports", import.meta.url).pathname;
fs.mkdirSync(dir, { recursive: true });

const jsonPath = path.join(dir, `${today}.json`);
const csvPath  = path.join(dir, `${today}.csv`);

fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2));
fs.writeFileSync(csvPath,  toCSV(items));

console.log(`[export] wrote ${jsonPath}`);
console.log(`[export] wrote ${csvPath}`);
console.log(`[export] done — ${items.length} row(s)`);
