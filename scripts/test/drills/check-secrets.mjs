#!/usr/bin/env node
// Scan logs and live HTTP responses without printing secret values or bodies.
import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

createRequire(import.meta.url)("dotenv").config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const args = process.argv.slice(2);
const values = new Map([
  ["MINTER_PRIVATE_KEY", process.env.MINTER_PRIVATE_KEY],
  ["PINATA_JWT", process.env.PINATA_JWT]
]);
const files = [];
const probeUrls = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--log-file" && args[index + 1]) files.push(args[++index]);
  else if (args[index] === "--probe-url" && args[index + 1]) probeUrls.push(args[++index]);
  else throw new Error("usage: check-secrets.mjs [--log-file path] [--probe-url URL]");
}
if (!probeUrls.length) {
  const base = (process.env.API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  probeUrls.push(`${base}/api/health`, `${base}/api/gallery`);
}

const needles = [["MINTER_PRIVATE_KEY", "MINTER_PRIVATE_KEY"], ["PINATA_JWT", "PINATA_JWT"]];
for (const [name, value] of values) if (typeof value === "string" && value.length >= 8) needles.push([name, value]);
const findings = [];
function inspect(source, text) {
  for (const [name, needle] of needles) if (text.includes(needle)) findings.push({ source, secret: name });
}

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
for (const file of files) inspect(file, await readFile(isAbsolute(file) ? file : resolve(repoRoot, file), "utf8"));
for (const url of probeUrls) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  inspect(`${url} (HTTP ${response.status})`, await response.text());
}

if (findings.length) {
  for (const finding of findings) console.error(`[q1-secrets] ${finding.secret} found in ${finding.source}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ scannedLogFiles: files.length, scannedResponses: probeUrls.length,
    checkedSecretNames: 2, configuredSecretValues: [...values.values()].filter((value) => typeof value === "string" && value.length >= 8).length,
    leaks: 0 }, null, 2));
}
