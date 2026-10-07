import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Vibrant SVG data URIs for mock graffiti artworks
function createSvgDataUri(tagText, color1, color2) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
      </linearGradient>
      <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <rect width="400" height="400" fill="#0d0f17" rx="20"/>
    <rect x="20" y="20" width="360" height="360" fill="none" stroke="${color1}" stroke-width="2" stroke-dasharray="10,5" rx="15" opacity="0.4"/>
    <circle cx="200" cy="200" r="120" fill="url(#grad)" opacity="0.25"/>
    <path d="M 60 200 Q 200 50 340 200 T 60 200" fill="none" stroke="${color2}" stroke-width="4" opacity="0.6"/>
    <text x="200" y="210" text-anchor="middle" dominant-baseline="middle" font-family="'Impact', 'Arial Black', sans-serif" font-size="34" font-weight="900" fill="#ffffff" filter="url(#neon-glow)">${tagText}</text>
    <text x="200" y="340" text-anchor="middle" font-family="monospace" font-size="12" fill="${color1}" opacity="0.8">NFT GRAFFITI WALL</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const NICKNAMES = [
  "CyberVandal", "NeonGhost", "GlitchKidd", "PixelRebel",
  "ZeroXSpray", "VoidWalker", "ChronoTag", "ByteBandit",
  "EtherPunk", "AuraBlaster", "SolWave", "MatrixMural"
];

const PALETTES = [
  ["#ff007f", "#00f0ff"],
  ["#39ff14", "#ffe600"],
  ["#b026ff", "#ff007f"],
  ["#00f0ff", "#39ff14"],
  ["#ff6600", "#ff0055"],
  ["#ffe600", "#00f0ff"]
];

let nextTokenId = 1;

// Seed initial approved artworks
let items = Array.from({ length: 12 }, (_, i) => {
  const nick = NICKNAMES[i % NICKNAMES.length];
  const [c1, c2] = PALETTES[i % PALETTES.length];
  const tokenId = nextTokenId++;
  return {
    id: `art-seed-${i + 1}`,
    tokenId,
    nickname: nick,
    imageCID: `bafybeiseed${i + 1}graffitiwallmockcid`,
    imageUrl: createSvgDataUri(nick, c1, c2),
    sha256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85${i}`,
    status: "approved",
    createdAt: new Date(Date.now() - (12 - i) * 60000).toISOString(),
    votes: Math.floor(Math.random() * 25) + 1,
  };
});

// REST Endpoints
app.get("/api/gallery", (req, res) => {
  const status = req.query.status;
  if (status && status !== "approved") {
    // Non-approved requires admin token according to frozen decisions
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  // Filter approved items
  const approved = items.filter((it) => it.status === "approved");
  res.json(approved);
});

app.get("/api/leaderboard", (_req, res) => {
  const leaderboard = items
    .filter((it) => it.status === "approved")
    .map((it) => ({
      id: it.id,
      tokenId: it.tokenId,
      nickname: it.nickname,
      votes: it.votes || 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  res.json(leaderboard);
});

// Socket.IO Namespace /gallery
const galleryIo = io.of("/gallery");

galleryIo.on("connection", (socket) => {
  console.log(`[mock-socket] Client connected to /gallery (${socket.id})`);

  socket.on("disconnect", () => {
    console.log(`[mock-socket] Client disconnected from /gallery (${socket.id})`);
  });
});

// Periodic live artwork emitter (emits 'new' every 10s)
let seedCounter = 13;
setInterval(() => {
  const nick = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)] + Math.floor(Math.random() * 90 + 10);
  const [c1, c2] = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const tokenId = nextTokenId++;

  const newItem = {
    id: `art-live-${seedCounter++}`,
    tokenId,
    nickname: nick,
    imageCID: `bafybeilive${seedCounter}mockipfs`,
    imageUrl: createSvgDataUri(nick, c1, c2),
    sha256: Math.random().toString(16).substring(2).padEnd(64, "0"),
    status: "approved",
    createdAt: new Date().toISOString(),
    votes: Math.floor(Math.random() * 5),
  };

  items.unshift(newItem);
  console.log(`[mock-socket] Emitting 'new' -> ${newItem.nickname} (#${newItem.tokenId})`);
  galleryIo.emit("new", newItem);
}, 10000);

// Periodic live hide emitter (emits 'hide' every 45s for testing instant removal)
setInterval(() => {
  if (items.length > 5) {
    const victim = items[items.length - 1];
    if (victim) {
      victim.status = "hidden";
      console.log(`[mock-socket] Emitting 'hide' -> ${victim.id}`);
      galleryIo.emit("hide", { id: victim.id });
    }
  }
}, 45000);

server.listen(PORT, () => {
  console.log(`[mock-server] Web Gallery Mock Server running on http://localhost:${PORT}`);
  console.log(`[mock-server] Socket.IO namespace /gallery active`);
  console.log(`[mock-server] REST endpoints: GET /api/gallery, GET /api/leaderboard`);
});
