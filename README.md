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

~~~text
Kiosk ── PNG + SHA-256 ──► Backend ──► IPFS (image + metadata)
                              │  └────► EVM chain (ERC-721 proof)
Gallery ◄── REST + Socket.IO ┘
Admin API ── authenticated moderation/config ──► Backend

Visitor phone ── QR ──► Static verify page ──► EVM chain + IPFS gateway
~~~

See [docs/architecture.md](./docs/architecture.md) for data flow, trust boundaries, and failure behavior.
Design principles:

- **Server holds minter key** — visitors never need a wallet.
- **Artwork on IPFS, proof on chain** — `CID + hash + nickname + timestamp`.
- **Verify page is static + trustless** — recomputes hash in browser, compares to on-chain value. No trust in backend.
- **Gallery reads the Neon PostgreSQL cache**; approved/hide changes are pushed over Socket.IO.
- **Hash exact bytes** uploaded to IPFS. Client pre-computes, server recomputes and rejects mismatches. Never re-encode between hashing and upload.
- **Retry transient failures** — the current queue is in memory and retries IPFS/chain calls up to three times; it is not a durable offline job store.
- **Admin interface status** — authenticated moderation/config API routes exist; the `web-admin` UI is not implemented yet.

Folder → service mapping:

| Folder | Service | Talks to |
|--------|---------|----------|
| `contracts/` | Solidity ERC-721 | Hardhat, testnet, backend |
| `backend/` | Express API + queue + WS | IPFS, chain, DB, all frontends |
| `web-kiosk/` | Draw + mint UX | backend REST + WS |
| `web-gallery/` | Live wall TV | backend REST + WS |
| `web-verify/` | Public verification | chain RPC + IPFS gateway directly |
| `web-admin/` | Planned moderation UI (not implemented) | backend admin API |
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
| Network | Polygon Amoy (chain ID 80002); local Hardhat fallback | Public verification or local development |
| IPFS | Pinata or local Kubo, with alternate-provider retry | Content-addressed storage |
| Backend | Node + Express | Mint queue, moderation API, IPFS pinning, WS |
| Realtime | Socket.IO / WS | Push to wall + kiosk progress |
| DB | Neon PostgreSQL | Artwork and moderation cache, votes, likes, config |
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
├── web-admin/                   # Planned moderation UI (not implemented)
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

### Render backend with Neon PostgreSQL

The repository includes `render.yaml` for the backend container. Create a Neon project and database, copy its pooled connection string (including `sslmode=require`), then create a Render Blueprint from this repository. Fill the Blueprint's unsynced `DATABASE_URL`, `CONTRACT_ADDRESS`, `MINTER_PRIVATE_KEY`, `PINATA_JWT`, and `CORS_ORIGIN` values in Render. Set `CORS_ORIGIN` to the deployed kiosk, gallery, and admin origins. The backend writes no persistent local files.

For an existing SQLite installation, first make a separate backup copy of `data.db`. From the repository root, set `DATABASE_URL` to the Neon URL and run `npm run migrate:sqlite-to-neon -- [path/to/data.db]`. The importer opens SQLite read-only, runs in a PostgreSQL transaction, and uses `ON CONFLICT DO NOTHING`; it never removes or overwrites source or destination rows. Review its inserted/skipped counts and compare table counts before changing the Render service to use Neon. Re-running is safe; skipped key conflicts should be investigated if the target was not already populated.

Database schema setup is additive and runs on backend startup. It creates missing tables/indexes and adds missing artwork columns. The mint queue stays in process memory: if the Render instance idles, restarts, or deploys, queued job payloads and upload progress disappear, even though persisted artwork, likes, moderation, and vote records remain in Neon. Visitors may need to resubmit a job interrupted by a restart. Render documents a 30-day expiration for its free Postgres, so this setup uses Neon for persistent database storage.

After Blueprint creation, provide the required unsynced secrets, confirm the health check passes, configure frontend `VITE_API_URL` and `VITE_WS_URL` to the Render service URL, and update CORS. This change does not deploy anything.

This local path uses Docker for Hardhat + Kubo + backend; Node 20+, npm 10+, and Docker Compose are required. No testnet account or Pinata account is needed.

### 1. Clone, install, and configure

~~~bash
git clone <repo-url> NFT-Graffiti-Wall
cd NFT-Graffiti-Wall
npm install
cp .env.example .env
~~~

Edit `.env`: set `CHAIN_NETWORK=localhost`, `RPC_URL=http://localhost:8545`, `IPFS_PROVIDER=kubo`, and `KUBO_API=http://localhost:5001`. Set `MINTER_PRIVATE_KEY` to the local Hardhat-only account key below and `ADMIN_TOKEN` to a non-empty local value. Never reuse these development credentials outside a local chain.

~~~text
Hardhat account 0 (local development only):
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
~~~

### 2. Start local chain and IPFS, then deploy

~~~bash
docker compose up -d hardhat kubo
docker compose ps                  # wait until both report healthy
docker compose exec hardhat npx hardhat run scripts/deploy.ts --network localhost
cat contracts/deployments/localhost.json
~~~

Copy the deployment `address` into `.env` as `CONTRACT_ADDRESS` and `VITE_CONTRACT_ADDRESS`. Also set `VITE_RPC_URL=http://localhost:8545`, `VITE_IPFS_GATEWAY=http://localhost:8080/ipfs/`, `VITE_VERIFY_URL=http://localhost:5175`, and a PostgreSQL `DATABASE_URL`. Docker Compose starts a local PostgreSQL service and supplies its URL automatically.

### 3. Start the backend and check it

~~~bash
docker compose up --build -d backend
curl http://localhost:3001/api/health
~~~

The response should have `ok: true`, `chain: true`, and `ipfs: true`. If configuration changes later, recreate the backend with the same Compose command.

### 4. Run the kiosk, gallery, and verify page

From the repository root, in separate terminals:

~~~bash
npm run dev -w @graffiti/web-kiosk      # http://localhost:5173
npm run dev -w @graffiti/web-gallery    # http://localhost:5174
VITE_RPC_URL=http://localhost:8545 VITE_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3 VITE_IPFS_GATEWAY=http://localhost:8080/ipfs/ npm run dev -w @graffiti/web-verify -- --port 5175
~~~

Draw and submit from the kiosk. After IPFS preparation, mint the submission from the authenticated admin queue; a confirmed mint is published to the gallery automatically.

To mint from a PNG file, use `npm run mint:test -- ./test-image.png "CyberNinja"` with the backend running. A successful run prints a token ID and `✅ VERIFIED`.

Stop the stack with `docker compose down`. Named data volumes are kept unless `-v` is added.

---

## 7. Smart Contract

`contracts/contracts/GraffitiWall.sol` — ERC-721 with on-chain proof struct.

- `tokenURI` → `ipfs://<metadataCID>`
- On-chain `Artwork { creator, nickname, ipfsCID, artworkHash, timestamp }` so verification doesn't depend on metadata hosting.
- `MINTER_ROLE` only (backend wallet) can `mint()`.
- `ArtworkMinted(tokenId, creator, nickname, ipfsCID, artworkHash)` event for gallery.
- `verify(id, candidateHash) -> bool` view.
- Tokens support standard ERC-721 transfers; a visitor claim UI/flow is not implemented.

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
| GET | `/api/artworks/:id/status` | Job stage: `hashing / uploading / ready / minting / confirmed / failed` |
| GET | `/api/gallery?status=approved` | Gallery list (paginated) |
| GET | `/api/health` | Chain/IPFS readiness, queue depth, and balance |
| POST | `/api/admin/artworks/:id/mint` | Mint prepared artwork and publish it after chain confirmation |
| POST | `/api/admin/artworks/:id/hide` | Hide from wall |
| POST | `/api/admin/artworks/:id/retry-ipfs` | Retry failed IPFS preparation |
| PUT | `/api/admin/config` | Kill switch and IPFS provider |
| POST | `/api/votes` | Cast vote (deduplicated by artwork/category/voter key) |
| GET | `/api/leaderboard` | Tallies |
| POST | `/api/admin/reset` | Archive day's data |
| POST | `/api/admin/clear-gallery` | Archive published gallery artwork and emit hide events |
| POST | `/api/admin/clear-mint-requests` | Cancel and archive pending submissions |
| Socket.IO `/gallery` | `new` / `hide` | New/hidden artwork events |
| Socket.IO `/status` | `subscribe(jobId)` / `job` | Mint progress for kiosk |

Data model:

```text
artworks(id, token_id, nickname, image_cid, metadata_cid, sha256,
         tx_hash, block_number, status[pending|minted|approved|hidden|failed],
         created_at)
votes(id, artwork_id, category, voter_key, created_at)
config(key, value)  -- moderation mode, kill switch, IPFS provider
```

Key invariants:

- Server **recomputes SHA-256** from received bytes, rejects mismatch (400).
- Size cap ≤ 500 KB, PNG only, artwork submission rate-limited per device/IP.
- Mint via in-memory queue with up to three retries; never expose `MINTER_PRIVATE_KEY`. Accepted job progress is lost if the backend process restarts.
- Kiosk submission pins the image and metadata first. The admin queue then exposes a single **Mint NFT** action; after the chain confirms, the artwork is published to the gallery automatically.

Full spec → [`backend/AGENT.md`](./backend/AGENT.md) + [`docs/api.md`](./docs/api.md).

---

## 9. Frontend Apps

| App | Route / screen | Key components |
|-----|----------------|----------------|
| **web-kiosk** | Attract → Canvas → Nickname → Mint progress → Certificate | `DrawingCanvas`, `MintProgress`, `CertificateCard`, `useMintJob` |
| **web-gallery** | Live grid + NEW animation + vote bars | `GalleryGrid`, `NewArtToast`, `useGallerySocket` |
| **web-verify** | Badge + hashes + tx link + tamper button | `VerifyBadge`, `HashCompare`, `TamperCanvas` |
| **web-admin** | Not implemented yet; use authenticated admin API | — |

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

- New art → staff mints the IPFS-prepared submission from the admin queue; successful chain confirmation publishes it to the wall. Staff can still hide minted work.
- **Hide button** (< 2 clicks), nickname profanity filter, size cap, rate-limit, admin kill switch (`KILL_SWITCH=true` stops new mints, gallery stays up).
- Claim/transfer is opt-in after event so club wallet stays the on-chain creator during expo, with nickname in metadata + event.

---

## 12. Configuration

All vars documented in `.env.example`. Key ones:

```bash
# Chain
CHAIN_NETWORK=polygon-amoy        # or sepolia | localhost
RPC_URL=https://rpc-amoy.polygon.technology/
CONTRACT_ADDRESS=                 # fill after Amoy deployment
MINTER_PRIVATE_KEY=0x...          # BACKEND ONLY, never frontend
# IPFS
IPFS_PROVIDER=pinata              # pinata | kubo; tries the alternate provider after failure
PINATA_JWT=...
KUBO_API=http://localhost:5001
IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
# Backend
PORT=3001
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
MAX_IMAGE_KB=500
RATE_LIMIT_PER_MIN=5
KILL_SWITCH=false
# Frontend (public values only)
VITE_API_URL=http://localhost:3001
VITE_RPC_URL=https://rpc-amoy.polygon.technology/
VITE_CONTRACT_ADDRESS=            # fill after Amoy deployment
VITE_CHAIN_ID=80002
VITE_EXPLORER_URL=https://amoy.polygonscan.com/
VITE_WS_URL=http://localhost:3001
VITE_VERIFY_URL=https://<deployed-public-verifier-domain>
VITE_CONTRACT_ADDRESS=0x...
VITE_RPC_URL=https://...
```

For testnet use, fund the minter wallet before the event and configure the real deployed address, RPC, and IPFS credentials. The admin API exposes the current balance through `/api/health`; there is no admin panel UI yet.

Set `VITE_VERIFY_URL` in the kiosk build environment to the deployed public HTTPS verifier origin. The kiosk will not generate a QR from a localhost URL; downloads are available on the phone-facing verifier after a ticket passes verification.

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

Staff roles: greeter, moderator (use an authenticated client for the admin API), explainer. Archive/export nightly. Record a fallback demo video. Bring hotspot backup, power strips, spare HDMI, optional printer for paper certificates (big hit), posters + QR-to-gallery sign.

Failure drills before event: IPFS down, RPC down, wallet out of gas, Wi-Fi drop, queue buildup, offensive art. See [`docs/booth-checklist.md`](./docs/booth-checklist.md).

---

## 14. Risk Register

| Risk | Impact | Mitigation |
|------|:---:|-----------|
| Offensive artwork | High | Moderation queue, hide button, nickname filter |
| Internet/RPC/IPFS outage | High | Retry queue, hotspot, local fallback, seed art |
| Minter out of test POL | High | Pre-fund, balance monitor, spare wallets |
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
