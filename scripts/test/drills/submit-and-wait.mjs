#!/usr/bin/env node
// Submit one deterministic PNG and wait for a confirmed/failed terminal status.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

createRequire(import.meta.url)("dotenv").config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const apiUrl = (process.env.API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const expected = process.argv[2] ?? "failed";
const label = process.argv[3] ?? "failure-drill";
const timeoutMs = Number(process.env.DRILL_TIMEOUT_MS ?? 120_000);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6d8AAAAASUVORK5CYII=", "base64");
if (!new Set(["confirmed", "failed"]).has(expected)) throw new Error("expected stage must be confirmed or failed");

const body = new FormData();
body.append("image", new Blob([png], { type: "image/png" }), "drill.png");
body.append("nickname", "Drill Test");
body.append("clientHash", createHash("sha256").update(png).digest("hex"));
const submitted = await fetch(`${apiUrl}/api/artworks`, {
  method: "POST", headers: { "X-Device-Id": `q1-${label}-${randomUUID()}` }, body,
  signal: AbortSignal.timeout(15_000)
});
if (submitted.status !== 202) throw new Error(`submission returned HTTP ${submitted.status}`);
const { jobId } = await submitted.json();
const deadline = Date.now() + timeoutMs;
let job;
while (Date.now() < deadline) {
  const response = await fetch(`${apiUrl}/api/artworks/${encodeURIComponent(jobId)}/status`, {
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`status returned HTTP ${response.status}`);
  job = await response.json();
  if (job.stage === "confirmed" || job.stage === "failed") break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (job?.stage !== expected) throw new Error(`expected ${expected}; got ${job?.stage ?? "timeout"}`);
console.log(JSON.stringify({ label, jobId, stage: job.stage, retry: job.retry ?? 0,
  errorReturned: Boolean(job.error) }, null, 2));
