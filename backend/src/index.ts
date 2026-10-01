import express from "express";
import { artworksRouter } from "./routes/artworks.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (_req, res) => res.json({ ok: true, chain: "unknown", ipfs: "unknown", queueDepth: 0 }));
app.use("/api/artworks", artworksRouter);

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => console.log(`backend listening on :${PORT}`));
