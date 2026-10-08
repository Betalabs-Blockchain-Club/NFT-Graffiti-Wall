#!/usr/bin/env node
// Submit and track 20-50 real mint jobs. Each submission gets a distinct
// device id; a separate malformed-upload burst checks the per-device limiter.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

createRequire(import.meta.url)("dotenv").config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const apiUrl = (process.env.API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const count = Number(process.argv[2] ?? process.env.LOAD_TEST_COUNT ?? 20);
const rateLimit = Number(process.env.RATE_LIMIT_PER_MIN ?? 5);
const pollMs = Number(process.env.LOAD_TEST_POLL_MS ?? 1000);
const timeoutMs = Number(process.env.LOAD_TEST_TIMEOUT_MS ?? 180_000);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6d8AAAAASUVORK5CYII=", "base64");
const clientHash = createHash("sha256").update(png).digest("hex");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function submit(deviceId, withImage = true) {
  const body = new FormData();
  if (withImage) {
    body.append("image", new Blob([png], { type: "image/png" }), "load-test.png");
    body.append("nickname", "Load Test");
    body.append("clientHash", clientHash);
  } else {
    body.append("nickname", "Rate Probe");
  }
  return fetch(`${apiUrl}/api/artworks`, {
    method: "POST", headers: { "X-Device-Id": deviceId }, body,
    signal: AbortSignal.timeout(15_000)
  });
}

async function run() {
  assert(Number.isInteger(count) && count >= 20 && count <= 50, "count must be an integer from 20 to 50");
  assert(Number.isInteger(rateLimit) && rateLimit >= 1 && rateLimit <= 100, "RATE_LIMIT_PER_MIN must be 1-100");

  const responses = await Promise.all(Array.from({ length: count }, (_, index) =>
    submit(`q1-load-${randomUUID()}-${index}`)));
  const jobs = [];
  for (const response of responses) {
    const text = await response.text();
    assert(response.status === 202, `mint submission was rejected with HTTP ${response.status}`);
    const payload = JSON.parse(text);
    assert(typeof payload.jobId === "string" && payload.status === "pending", "submit response did not match the API contract");
    jobs.push(payload.jobId);
  }
  assert(new Set(jobs).size === count, "backend returned duplicate job ids");

  const rateDevice = `q1-rate-${randomUUID()}`;
  for (let index = 0; index < rateLimit; index += 1) {
    const response = await submit(rateDevice, false);
    await response.body?.cancel();
    assert(response.status === 400, `rate probe ${index + 1} expected 400 before the limit; got ${response.status}`);
  }
  const limited = await submit(rateDevice, false);
  await limited.body?.cancel();
  assert(limited.status === 429 && Number(limited.headers.get("retry-after")) > 0,
    `rate limiter expected 429 with Retry-After; got ${limited.status}`);

  const pending = new Set(jobs);
  const latest = new Map();
  const deadline = Date.now() + timeoutMs;
  while (pending.size && Date.now() < deadline) {
    await Promise.all([...pending].map(async (jobId) => {
      const response = await fetch(`${apiUrl}/api/artworks/${encodeURIComponent(jobId)}/status`, {
        signal: AbortSignal.timeout(10_000)
      });
      assert(response.ok, `status lookup failed for job ${jobId}: HTTP ${response.status}`);
      const job = await response.json();
      latest.set(jobId, job);
      if (job.stage === "confirmed" || job.stage === "failed") pending.delete(jobId);
    }));
    if (pending.size) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  assert(pending.size === 0, `${pending.size} accepted jobs never reached a terminal state`);
  const failed = [...latest.values()].filter((job) => job.stage === "failed").length;
  assert(failed === 0, `${failed} of ${count} accepted mint jobs failed`);
  assert([...latest.values()].every((job) => Number.isSafeInteger(job.tokenId) && job.txHash),
    "a confirmed job is missing its token id or transaction hash");

  console.log(JSON.stringify({ submitted: count, confirmed: count, lost: 0, failed: 0,
    rateLimit: { allowedMalformedRequests: rateLimit, rejectedAfterLimit: limited.status,
      retryAfter: limited.headers.get("retry-after") } }, null, 2));
}

run().catch((error) => {
  console.error(`[q1-load] ${error instanceof Error ? error.message : "load test failed"}`);
  process.exitCode = 1;
});
