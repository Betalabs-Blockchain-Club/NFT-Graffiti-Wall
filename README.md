# 🔗 NFT Graffiti Wall — TechFest Expo

> **Tagline:** "You have 60 seconds. Create something. Put it on the blockchain."
> **Pipeline:** `DRAW → HASH → IPFS → MINT → VERIFY → LIVE GALLERY`

Visitors draw on a canvas. The artwork is hashed (SHA-256), pinned to IPFS, minted as an ERC-721 NFT, and shown on a live gallery wall with a QR certificate. A **tamper demo** proves why hashes and content-addressing matter.

**Key message:** *Creation → Cryptographic proof → Decentralized storage → Blockchain record → Verification.*

This README is the single entry point for the whole project. The original expo plan is preserved in [`nft_graffiti_wall_plan.md`](./nft_graffiti_wall_plan.md). Each folder has its own `AGENT.md` with inputs, outputs, and responsibilities so team members / AI agents can work in parallel without stepping on each other.

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [Visitor Experience (60–120s)](#2-visitor-experience-60–120s)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Repo Structure](#5-repo-structure)
6. [Quickstart](#6-quickstart)
7. [Smart Contract](#7-smart-contract)
8. [Backend API](#8-backend-api)
9. [Frontend Apps](#9-frontend-apps)
10. [Verification + Tamper Demo](#10-verification--tamper-demo)
11. [Moderation & Safety](#11-moderation--safety)
12. [Configuration](#12-configuration)
13. [Event Operations](#13-event-operations)
14. [Risk Register](#14-risk-register)
15. [Success Metrics](#15-success-metrics)
16. [Roadmap / Phases](#16-roadmap--phases)
17. [Team Workflow](#17-team-workflow)

---

## 1. What This Is

A flagship TechFest stall that teaches 3 core Web3 ideas in one tangible flow:

1. **Hashing = digital fingerprint** — SHA-256 of the exact PNG bytes.
2. **IPFS = decentralized storage** — CID is itself a content hash.
3. **NFT = immutable proof** — ERC-721 stores `ipfsCID + artworkHash + nickname + timestamp` on-chain.

Take-home: QR certificate on the visitor's own phone linking to a public verify page. No wallet needed for visitors — the backend holds the minter key.

Scores from the plan:

| Criterion | Rating |
|-----------|:---:|
| Attraction / foot-traffic | ⭐⭐⭐⭐⭐ |
| Blockchain relevance | ⭐⭐⭐⭐ |
| Buildability | ⭐⭐⭐⭐ |
| Throughput (30–60 visitors/hr/station) | ⭐⭐⭐⭐⭐ |
| Take-home value | ⭐⭐⭐⭐⭐ |

---

## 2. Visitor Experience (60–120s)

| Step | Screen | What happens |
|:---:|--------|--------------|
| 1 | **Draw** | Canvas: brush, eraser, colour picker, size, undo/redo, clear. Optional 60-s countdown. |
| 2 | **Nickname** | Single text field, profanity filter. No real name needed. |
| 3 | **Hash** | Canvas → PNG → SHA-256, shown as "digital fingerprint". |
| 4 | **IPFS** | Upload artwork + metadata JSON, show CID. |
| 5 | **Mint** | Contract call with animated stages + tx hash / block number. |
| 6 | **Certificate** | Card with artwork, token ID, date, QR. Download/share/print. |
| 7 | **Gallery** | New piece animates onto live wall. |
| 8 | **Tamper (optional)** | "Try to tamper" → hash changes → ❌ verification failed. |

UX rules: big touch-friendly controls, auto-reset to idle after 30–45s inactivity, one CTA per screen, no typing beyond nickname.

90-second demo script:

```text
Draw artwork → Hash it → Pin to IPFS → Mint NFT → Tx confirmed
→ QR certificate → Appears on live wall → Tamper → Hash changes → ❌ Verification fails
```

---

## 3. Architecture

```text
┌───────────────────────┐        ┌──────────────────────────────┐
│ Draw Kiosk (React)    │  REST  │ Backend API (Node/Express)   │
│ Canvas → PNG → SHA256 │◄──────►│ - validation, rate-limit     │
└───────────────────────┘        │ - moderation state           │
                                 │ - IPFS pinning               │
┌───────────────────────┐   WS   │ - holds MINTER key (server)  │
│ Gallery Wall (React)  │◄──────►│ - mint queue + retry         │
│ TV / projector        │        │ - SQLite/Postgres            │
└───────────────────────┘        └───────┬───────────┬──────────┘
                                         │           │
┌───────────────────────┐                ▼           ▼
│ Admin Panel (React)   │        ┌──────────────┐ ┌──────────────┐
│ approve / hide / reset│        │ IPFS (Pinata │ │ EVM chain    │
└───────────────────────┘        │ / local Kubo)│ │ ERC-721      │
                                 └──────────────┘ │ (L2 testnet) │
┌───────────────────────┐                         └──────┬───────┘
│ Verify Page (public)  │◄───────────────────────────────┘
│ static site, reads    │   reads tokenURI + hash via public RPC
│ chain + IPFS gateway  │
└───────────────────────┘
```

Design principles:

- **Server holds minter key** — visitors never need a wallet.
- **Artwork on IPFS, proof on chain** — `CID + hash + nickname + timestamp`.
- **Verify page is static + trustless** — recomputes hash in browser, compares to on-chain value. No trust in backend.
- **Gallery reads DB cache** for speed, subscribes to `ArtworkMinted` events for authenticity.
- **Hash exact bytes** uploaded to IPFS. Client pre-computes, server recomputes and rejects mismatches. Never re-encode between hashing and upload.
- **Queue everything** — mint jobs with retry/backoff so visitors never wait on a failed RPC/IPFS call.

Folder → service mapping:

| Folder | Service | Talks to |
|--------|---------|----------|
| `contracts/` | Solidity ERC-721 | Hardhat, testnet, backend |
| `backend/` | Express API + queue + WS | IPFS, chain, DB, all frontends |
| `web-kiosk/` | Draw + mint UX | backend REST + WS |
| `web-gallery/` | Live wall TV | backend REST + WS |
| `web-verify/` | Public verification | chain RPC + IPFS gateway directly |
| `web-admin/` | Moderation | backend admin API |
| `shared/` | Hash/canvas/api/types | all frontends + backend |
| `docs/`, `scripts/`, `infra/` | Ops knowledge | humans + CI |

See root [`AGENT.md`](./AGENT.md) for agent boundaries, and each folder's `AGENT.md` for I/O contracts.

---

## 4. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React + Vite + TypeScript, Tailwind | Fast iteration |
| Drawing | HTML Canvas (+ `perfect-freehand`) | Lightweight, PNG export |
| Hashing | Web Crypto `crypto.subtle.digest('SHA-256')` | Built-in; same call in tamper demo |
| Animation | Framer Motion, confetti | Mint + new-art effects |
| Contract | Solidity 0.8.x, OpenZeppelin ERC721URIStorage + AccessControl | Audited standard |
| Dev tooling | Hardhat + TypeChain | Tests, deploys, typed bindings |
| Chain client | ethers.js v6 | Contract calls + events |
| Network | Sepolia or L2 testnet (Base Sepolia / Polygon Amoy / Arbitrum Sepolia); local Hardhat fallback | Public verifiable + cheap/fast; offline fallback |
| IPFS | Pinata (primary), local Kubo (fallback) | Reliable pinning + offline mode |
| Backend | Node + Express | Mint queue, moderation, IPFS proxy, WS |
| Realtime | Socket.IO / WS | Push to wall + kiosk progress |
| DB | SQLite (dev/expo) → Postgres (optional) | Artworks, votes, config |
| QR | `qrcode` / `qrcode.react` | Links to `verify.<domain>/#/token/37` |
| Hosting | Verify + gallery static on Vercel/Netlify; backend on expo laptop or VPS | Public verification, local control |

---

## 5. Repo Structure

```text
NFT-Graffiti-Wall/
├── README.md                    # this file
├── AGENT.md                     # root orchestrator: who owns what, global contracts
├── nft_graffiti_wall_plan.md    # original expo plan (source of truth for vision)
├── .env.example                 # all env vars in one place
├── docker-compose.yml           # backend + db + kubo + hardhat node (local fallback)
├── package.json                 # npm workspaces
│
├── contracts/                   # Solidity + tests + deploy
│   ├── AGENT.md
│   ├── contracts/GraffitiWall.sol
│   ├── test/GraffitiWall.test.ts
│   ├── scripts/deploy.ts
│   └── hardhat.config.ts
│
├── backend/                     # Express API: validation, IPFS, mint queue, WS, DB
│   ├── AGENT.md
│   └── src/
│       ├── routes/      # artworks, gallery, votes, admin
│       ├── services/    # ipfs, chain, queue, moderation, storage
│       ├── ws/          # gallery + job-status sockets
│       ├── db/          # schema.sql, client, migrations
│       ├── middleware/  # rate-limit, validation, auth
│       ├── config/      # env, networks
│       └── utils/       # hash, image, nickname filter
│
├── web-kiosk/                   # Draw station UX
│   ├── AGENT.md
│   └── src/components|pages|hooks|lib
├── web-gallery/                 # TV wall
│   ├── AGENT.md
│   └── src/components|pages|hooks
├── web-verify/                  # Public static verify + tamper demo
│   ├── AGENT.md
│   └── src/components|pages|lib
├── web-admin/                   # Moderation queue, network mode, kill switch
│   ├── AGENT.md
│   └── src/components|pages
│
├── shared/                      # Cross-app code (must stay framework-free)
│   ├── AGENT.md
│   └── src/hashing|canvas|api-client|types|qr
│
├── docs/                        # architecture, api, booth checklists, explainer
│   ├── AGENT.md
│   ├── architecture.md
│   ├── api.md
│   ├── contract.md
│   ├── demo-script.md
│   └── booth-checklist.md
├── scripts/                     # e2e-mint, seed-wall, export-data, fallback-video
│   └── AGENT.md
└── infra/                       # docker, nginx, CI
    ├── AGENT.md
    └── docker/ nginx/
```

> Rule: `shared/` must never import from `backend/` or `web-*`. Frontends import from `shared/` only. Backend is the only holder of `MINTER_PRIVATE_KEY`.

---

## 6. Quickstart

### Prerequisites

- Node 20+, npm 10+
- A testnet RPC URL + funded minter key (or use local Hardhat)
- Pinata JWT (or use local Kubo)
- Docker (optional, for full local fallback)

### 1. Clone + install

```bash
git clone <repo-url> NFT-Graffiti-Wall
cd NFT-Graffiti-Wall
npm install
cp .env.example .env
# fill in RPC_URL, MINTER_PRIVATE_KEY, PINATA_JWT, CONTRACT_ADDRESS after deploy
```

### 2. Contract (local test)

```bash
cd contracts
npm install
npx hardhat test
npx hardhat node &              # terminal 1: local chain
npx hardhat run scripts/deploy.ts --network localhost  # terminal 2
```

### 3. Backend (dev)

```bash
cd backend
npm install
npm run dev                     # http://localhost:3001
# health: curl http://localhost:3001/api/health
```

### 4. Frontends (each in own terminal)

```bash
cd web-kiosk && npm install && npm run dev      # http://localhost:5173
cd web-gallery && npm install && npm run dev    # http://localhost:5174
cd web-verify && npm install && npm run dev     # http://localhost:5175
cd web-admin && npm install && npm run dev      # http://localhost:5176
```

### 5. Full local fallback (no internet) via Docker

```bash
docker compose up --build
# backend :3001, hardhat :8545, kubo :5001/:8080
```

### 6. End-to-end CLI smoke test

```bash
npm run mint:test -- scripts/e2e-mint.js ./test-image.png "CyberNinja"
# expects: PNG in → imageCID → metadataCID → txHash/tokenId → tokenURI resolves → ✅ VERIFIED
```

Pre-mint ~10 seed artworks before opening so the wall is never empty.

---

## 7. Smart Contract

`contracts/contracts/GraffitiWall.sol` — ERC-721 with on-chain proof struct.

- `tokenURI` → `ipfs://<metadataCID>`
- On-chain `Artwork { creator, nickname, ipfsCID, artworkHash, timestamp }` so verification doesn't depend on metadata hosting.
- `MINTER_ROLE` only (backend wallet) can `mint()`.
- `ArtworkMinted(tokenId, creator, nickname, ipfsCID, artworkHash)` event for gallery.
- `verify(id, candidateHash) -> bool` view.
- Claim flow = standard `transferFrom` to visitor address.

Metadata JSON (pinned to IPFS):

```json
{
  "name": "Blockchain Art #37",
  "description": "Created at TechFest 2026 by CyberNinja",
  "image": "ipfs://<imageCID>",
  "attributes": [
    { "trait_type": "Creator", "value": "CyberNinja" },
    { "trait_type": "SHA-256", "value": "9f2c7d8a..." },
    { "trait_type": "Event", "value": "TechFest 2026" }
  ]
}
```

Voting: keep **off-chain** (DB + device dedupe), publish final tallies on-chain once at end. Gas per vote is wasteful.

Full spec → [`contracts/AGENT.md`](./contracts/AGENT.md) + [`docs/contract.md`](./docs/contract.md).

---

## 8. Backend API

Base: `http://localhost:3001`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/artworks` | Submit PNG + nickname + client hash → creates job |
| GET | `/api/artworks/:id/status` | Job stage: `hashing / uploading / minting / confirmed / failed` |
| GET | `/api/gallery?status=approved` | Gallery list (paginated) |
| POST | `/api/admin/artworks/:id/approve` | Moderation approve |
| POST | `/api/admin/artworks/:id/hide` | Hide from wall |
| POST | `/api/votes` | Cast vote (rate-limited) |
| GET | `/api/leaderboard` | Tallies |
| POST | `/api/admin/reset` | Archive day's data |
| Socket.IO `/gallery` | `new` / `hide` | New/hidden artwork events |
| Socket.IO `/status` | `subscribe(jobId)` / `job` | Mint progress for kiosk |

Data model:

```text
artworks(id, token_id, nickname, image_cid, metadata_cid, sha256,
         tx_hash, block_number, status[pending|minted|approved|hidden|failed],
         created_at)
votes(id, artwork_id, category, voter_key, created_at)
config(key, value)  -- network mode, moderation on/off, limits
```

Key invariants:

- Server **recomputes SHA-256** from received bytes, rejects mismatch (400).
- Size cap ≤ 500 KB, PNG only, rate-limit per IP/device.
- Mint via queue with retry/backoff; never expose `MINTER_PRIVATE_KEY`.
- Moderation: `mint immediately but display only approved` OR `mint after approval` — configurable via `config.moderation_mode`.

Full spec → [`backend/AGENT.md`](./backend/AGENT.md) + [`docs/api.md`](./docs/api.md).

---

## 9. Frontend Apps

| App | Route / screen | Key components |
|-----|----------------|----------------|
| **web-kiosk** | Attract → Canvas → Nickname → Mint progress → Certificate | `DrawingCanvas`, `MintProgress`, `CertificateCard`, `useMintJob` |
| **web-gallery** | Live grid + NEW animation + vote bars | `GalleryGrid`, `NewArtToast`, `useGallerySocket` |
| **web-verify** | Badge + hashes + tx link + tamper button | `VerifyBadge`, `HashCompare`, `TamperCanvas` |
| **web-admin** | Queue + hide/restore + network mode + queue health | `ModerationQueue`, `NetworkSwitch`, `QueueHealth` |

Shared code lives in `shared/` (hashing, canvas export, api-client, types, QR). No duplication of hash logic — one implementation, used everywhere.

---

## 10. Verification + Tamper Demo

Public flow (no backend trust):

```text
QR → verify page → read artwork(tokenId) from chain
   → fetch image from IPFS gateway
   → SHA-256 in browser → compare with on-chain hash
   → ✅ VERIFIED or ❌ FAILED
```

Tamper demo:

1. Load original image into canvas.
2. **"Try to tamper"** flips pixels / draws dot.
3. Re-export → recompute SHA-256.
4. Show original vs new hash side-by-side → ❌.
5. Line: *"The blockchain still remembers the original fingerprint — the modified copy can't pass for it."*

Honesty note: tampering doesn't alter the chain — it **breaks verification**. The IPFS CID is itself a content hash.

---

## 11. Moderation & Safety

Why: public screen + permanent NFTs = offensive-art risk is **high impact**.

- New art → **staff approval screen** before wall. Mint immediately but display only `approved`, or mint after approval (configurable).
- **Hide button** (< 2 clicks), nickname profanity filter, size cap, rate-limit, admin kill switch (`KILL_SWITCH=true` stops new mints, gallery stays up).
- Claim/transfer is opt-in after event so club wallet stays the on-chain creator during expo, with nickname in metadata + event.

---

## 12. Configuration

All vars documented in `.env.example`. Key ones:

```bash
# Chain
CHAIN_NETWORK=base-sepolia        # or sepolia | polygon-amoy | localhost
RPC_URL=https://...
CONTRACT_ADDRESS=0x...
MINTER_PRIVATE_KEY=0x...          # BACKEND ONLY, never frontend
# IPFS
IPFS_PROVIDER=pinata              # pinata | kubo
PINATA_JWT=...
KUBO_API=http://localhost:5001
IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
# Backend
PORT=3001
DATABASE_URL=file:./data.db
MODERATION_MODE=display_after_approve  # or mint_after_approve
MAX_IMAGE_KB=500
RATE_LIMIT_PER_MIN=5
KILL_SWITCH=false
# Frontend
VITE_API_URL=http://localhost:3001
VITE_VERIFY_URL=https://verify.example.com
VITE_CONTRACT_ADDRESS=0x...
VITE_RPC_URL=https://...
```

Test-ETH: fund minter wallet **days early** (~200 mints is cheap on L2). Keep spare faucet accounts. Admin panel shows balance monitor.

---

## 13. Event Operations

Booth layout:

```text
      ┌──────────────────────────┐
      │ TV / PROJECTOR           │
      │ LIVE NFT GALLERY         │
      └──────────────────────────┘
          💻 Draw kiosk (touch if possible)
          💻 Admin/moderator laptop
          📱 Visitor phones → verify QR
```

Boot checklist (every morning): balance check → contract reachable → IPFS key valid → test mint → test verify **from a phone** on cellular (not expo Wi-Fi).

Staff roles: greeter, moderator (admin panel), explainer. Archive/export nightly. Record a fallback demo video. Bring hotspot backup, power strips, spare HDMI, optional printer for paper certificates (big hit), posters + QR-to-gallery sign.

Failure drills before event: IPFS down, RPC down, wallet out of gas, Wi-Fi drop, queue buildup, offensive art. See [`docs/booth-checklist.md`](./docs/booth-checklist.md).

---

## 14. Risk Register

| Risk | Impact | Mitigation |
|------|:---:|-----------|
| Offensive artwork | High | Moderation queue, hide button, nickname filter |
| Internet/RPC/IPFS outage | High | Retry queue, hotspot, local fallback, seed art |
| Minter out of test ETH | High | Pre-fund, balance monitor, spare wallets |
| Slow mints → queue | Med | Staged animation, L2, 2nd kiosk, gallery while waiting |
| Verify page unreachable | Med | Public static hosting, short-URL QR |
| Hash mismatch (re-encoding) | Med | Hash exact bytes; server recomputes |
| Spam/abuse | Med | Rate limits, size cap, kill switch |
| NFT ownership confusion | Low | Explainer card: testnet = no real value |

---

## 15. Success Metrics

- Artworks minted / hour / day
- Median Start → certificate time
- Mint success rate + retry count
- QR scans / verify visits
- Votes cast, repeat visitors
- Club sign-ups, social posts/tags
- Qualitative: "Can you explain what the hash proves?"

---

## 16. Roadmap / Phases

Assumes 3–4 people, ~3 weeks. See plan §9 for checkboxes.

- **Phase 0 (Days 1–2):** freeze MVP, choose network, scaffold repo, fund wallet, Pinata.
- **Phase 1 (Week 1):** contract + tests + deploy; backend validation/IPFS/mint/DB; CLI e2e; queue+retry.
- **Phase 2 (Week 2):** canvas + hashing + progress + QR cert; gallery WS; admin; verify + tamper.
- **Phase 3 (Week 3):** voting (off-chain), idle reset, branding, cert download, local-fallback switch.
- **Phase 4 (last 3–4 days):** load test 50+ mints, playtest, failure drills, 10 seed arts, posters, fallback video.
- **Stretch:** Break-the-Chain side demo, 2nd station, collaborative mural, claim-to-wallet, AR preview, printed proof card.

MVP must-haves: canvas+PNG, SHA-256, IPFS, ERC-721+mint, gallery, QR cert+verify, **moderation/hide**.

---

## 17. Team Workflow

- Each folder has an `AGENT.md` — **read it before editing that folder**. It defines inputs, outputs, functions, and done-criteria.
- Branch per service: `feat/kiosk-canvas`, `feat/contract-mint`, `feat/verify-tamper`, etc. PRs must cite the folder's `AGENT.md` contract.
- `shared/` changes require sign-off from at least one frontend + backend owner (it affects everyone).
- Never commit `.env`, `MINTER_PRIVATE_KEY`, or `PINATA_JWT`. Use `.env.example` + local `.env`.
- Contract changes → redeploy → update `CONTRACT_ADDRESS` in backend `.env` + all `VITE_CONTRACT_ADDRESS`. Announce in PR.
- Daily expo rehearsal in last week: run `scripts/e2e-mint.js` + phone verify.

Start here:

- Orchestrator: [`AGENT.md`](./AGENT.md)
- Contract dev → [`contracts/AGENT.md`](./contracts/AGENT.md)
- Backend dev → [`backend/AGENT.md`](./backend/AGENT.md)
- Kiosk/gallery/verify/admin → `web-*/AGENT.md`
- Shared lib → [`shared/AGENT.md`](./shared/AGENT.md)
- Ops/docs → [`docs/AGENT.md`](./docs/AGENT.md), [`scripts/AGENT.md`](./scripts/AGENT.md), [`infra/AGENT.md`](./infra/AGENT.md)
