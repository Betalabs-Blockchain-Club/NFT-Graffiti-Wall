#!/usr/bin/env node
// Verify POST is blocked while read endpoints remain healthy; always restore false.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

createRequire(import.meta.url)("dotenv").config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const apiUrl = (process.env.API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const adminToken = process.env.ADMIN_TOKEN;
if (!adminToken) throw new Error("ADMIN_TOKEN is required");
const auth = { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" };
async function setKillSwitch(value) {
  const response = await fetch(`${apiUrl}/api/admin/config`, {
    method: "PUT", headers: auth, body: JSON.stringify({ KILL_SWITCH: value }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`config update returned HTTP ${response.status}`);
}

let posted = false;
try {
  await setKillSwitch(true);
  const health = await fetch(`${apiUrl}/api/health`);
  const gallery = await fetch(`${apiUrl}/api/gallery`);
  if (!health.ok || !gallery.ok) throw new Error("read endpoints failed while the kill switch was on");

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6d8AAAAASUVORK5CYII=", "base64");
  const body = new FormData();
  body.append("image", new Blob([png], { type: "image/png" }), "kill-switch.png");
  body.append("nickname", "Kill Switch");
  body.append("clientHash", createHash("sha256").update(png).digest("hex"));
  const response = await fetch(`${apiUrl}/api/artworks`, {
    method: "POST", headers: { "X-Device-Id": `q1-kill-${randomUUID()}` }, body
  });
  posted = response.status === 503;
  await response.body?.cancel();
  if (!posted) throw new Error(`POST expected 503; got ${response.status}`);
  console.log(JSON.stringify({ postBlocked: true, healthReadable: true, galleryReadable: true }));
} finally {
  await setKillSwitch(false);
}
