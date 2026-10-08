import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { createStorage } from "./services/storage.js";
import { createIpfs } from "./services/ipfs.js";
import { createChain } from "./services/chain.js";
import { createMintQueue } from "./services/queue.js";
import { createRealtime } from "./ws/index.js";
import { createGalleryRouter } from "./routes/gallery.js";
import { createAdminRouter } from "./routes/admin.js";
import { createVotesRouter } from "./routes/votes.js";
import { createHealthRouter } from "./routes/health.js";
import { createArtworksRouter } from "./routes/artworks.js";
import { env } from "./config/env.js";

if (env.databasePath !== ":memory:") mkdirSync(dirname(env.databasePath), { recursive: true });
const storage = createStorage(env.databasePath);
if (storage.getConfig("MODERATION_MODE") === "display_after_approve"
  && env.MODERATION_MODE !== "display_after_approve") {
  storage.setConfig({ MODERATION_MODE: env.MODERATION_MODE });
}
if (storage.getConfig("IPFS_PROVIDER") === "pinata" && env.IPFS_PROVIDER !== "pinata") {
  storage.setConfig({ IPFS_PROVIDER: env.IPFS_PROVIDER });
}
if (env.KILL_SWITCH) storage.setConfig({ KILL_SWITCH: true });

const chain = createChain({ rpcUrl: env.RPC_URL, contractAddress: env.CONTRACT_ADDRESS, minterPrivateKey: env.MINTER_PRIVATE_KEY, expectedChainId: env.expectedChainId });
const getIpfs = () => createIpfs({
  provider: storage.getConfig("IPFS_PROVIDER"), pinataJwt: env.PINATA_JWT,
  kuboApi: env.KUBO_API, gatewayUrl: env.IPFS_GATEWAY
});
const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json({ limit: "1mb" }));
const httpServer = createServer(app);
const realtime = createRealtime(httpServer, { allowedOrigin: env.corsOrigins });
const queue = createMintQueue({
  ipfs: { pinImage: (bytes) => getIpfs().pinImage(bytes), pinMetadata: (metadata) => getIpfs().pinMetadata(metadata) },
  chain, storage, realtime: { onJob: (job) => realtime.emitJob(job.jobId, job) }
});

app.use(createHealthRouter({ checks: {
  chain: () => chain.ping(),
  ipfs: async () => {
    const provider = storage.getConfig("IPFS_PROVIDER");
    const endpoint = provider === "pinata" ? "https://api.pinata.cloud/data/testAuthentication"
      : `${env.KUBO_API.replace(/\/$/, "").replace(/\/api\/v0$/, "")}/api/v0/id`;
    const response = await fetch(endpoint, {
      method: provider === "pinata" ? "GET" : "POST",
      headers: provider === "pinata" ? { Authorization: `Bearer ${env.PINATA_JWT}` } : undefined,
      signal: AbortSignal.timeout(5_000)
    });
    return response.ok;
  },
  queueDepth: () => queue.getQueueDepth(),
  balanceEth: () => chain.getBalanceEth()
} }));
app.use("/api/artworks", createArtworksRouter({
  storage, queue, maxImageKb: env.MAX_IMAGE_KB, rateLimitPerMinute: env.RATE_LIMIT_PER_MIN,
  deviceKey: (req) => req.get("X-Device-Id")?.trim() || req.ip || "unknown"
}));
app.use(createGalleryRouter({ storage, adminToken: env.ADMIN_TOKEN }));
app.use(createAdminRouter({ storage, queue, adminToken: env.ADMIN_TOKEN, hooks: {
  onApproved: (item) => realtime.emitNew(item), onHidden: (id) => realtime.emitHide(id)
} }));
app.use(createVotesRouter({ storage }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("backend request failed");
  if (res.headersSent) return;
  res.status(500).json({ code: "internal-error", message: "The request could not be completed" });
});

httpServer.listen(env.PORT, () => console.log(`backend listening on :${env.PORT}`));

let shutdown: Promise<void> | undefined;
async function stop(signal: string) {
  shutdown ??= (async () => {
    console.log(`backend shutting down (${signal})`);
    await realtime.close();
    queue.close();
    while (queue.getQueueDepth() > 0) await new Promise((resolve) => setTimeout(resolve, 100));
    storage.close();
    chain.provider.destroy();
  })();
  await shutdown;
}
process.once("SIGINT", () => { void stop("SIGINT").catch(() => { process.exitCode = 1; }); });
process.once("SIGTERM", () => { void stop("SIGTERM").catch(() => { process.exitCode = 1; }); });
