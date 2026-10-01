# 🔗 NFT Graffiti Wall — TechFest Expo Plan

> **Tagline:** "You have 60 seconds. Create something. Put it on the blockchain."
> **Pipeline:** `DRAW → HASH → IPFS → MINT → VERIFY → LIVE GALLERY`

Visitors draw on a canvas; the artwork is hashed (SHA-256), pinned to IPFS, minted as an ERC-721 NFT, and shown on a live gallery wall with a QR certificate. A **tamper demo** proves why hashes and content addressing matter.

---

## 1. Analysis

### 1.1 Scorecard

| Criterion | Rating | Notes |
|-----------|:---:|-------|
| Attraction / foot-traffic | ⭐⭐⭐⭐⭐ | Everyone can draw; the live wall is a built-in crowd magnet |
| Blockchain relevance | ⭐⭐⭐⭐ | Hash, IPFS, ERC-721, verification — the full "proof of existence" story |
| Buildability | ⭐⭐⭐⭐ | Standard stack, no custom game logic |
| Throughput | ⭐⭐⭐⭐⭐ | 60–120 s per visitor → 30–60 visitors/hour/station |
| Take-home value | ⭐⭐⭐⭐⭐ | QR certificate on the visitor's own phone |

**Strengths:** very low barrier to entry, highly visual, quick turnaround, great for photos/social media, teaches hashing + decentralized storage + immutability in one flow.

### 1.2 Issues to solve (important)

| # | Issue | Why it matters | Recommended fix |
|---|-------|----------------|-----------------|
| 1 | **Offensive / inappropriate drawings on a public screen** | Real risk at open events; NFTs are permanent | **Moderation queue**: new art goes to a staff approval screen *before* it hits the wall; mint only after approval (or mint immediately but only *display* approved ones). Add a "hide" button. |
| 2 | **QR verification needs to be reachable from visitor phones** | A purely local setup (localhost chain) can't be opened by random phones | Host the verify page publicly (Vercel/Netlify/GitHub Pages) reading from a **public testnet** + IPFS gateway. Keep local mode only as a fallback. |
| 3 | **Internet dependency** (IPFS pinning, testnet RPC) | Expo Wi-Fi is unreliable | Mobile hotspot as backup, **local-fallback mode** (Hardhat + local Kubo IPFS), and a mint **queue with retry** so visitors never wait on a failed call. |
| 4 | **Minting latency** (testnet blocks ≈ 2–12 s, IPFS 1–5 s) | Visitors lose interest | Show a **staged progress animation** (Hashing → Uploading → Minting → Confirmed). Pre-compute hash client-side while uploading. Use a fast L2 testnet if possible. |
| 5 | **Creator ownership** | With a club wallet minting, the "creator" on-chain is the club | Store the **nickname in metadata + event**; optionally add "claim to my wallet" (transfer to visitor address after the event). |
| 6 | **Tamper demo honesty** | Tampering an image doesn't alter the chain — it breaks *verification* | Frame it correctly: "the chain remembers the original fingerprint; any edited copy fails the check." Also point out that the IPFS CID itself is a content hash. |
| 7 | **Spam / abuse** | Someone mints hundreds of items | Rate-limit per session/device, cap size (e.g. ≤ 500 KB), admin kill switch. |
| 8 | **Test-ETH supply** | Faucets can be rate-limited right before the event | Fund the minter wallet **days early**; ~200 mints costs little on L2 testnets. Keep spare faucet accounts. |

### 1.3 Recommendation

Build it as the **flagship stall**. Compared with a game-style booth, this has far higher throughput and a more tangible take-home. Optionally pair it with a small "Break the Chain" hash demo as a queue-filler (see Stretch Goals).

---

## 2. Visitor Experience

Target: **60–120 seconds** end-to-end.

| Step | Screen | What happens |
|:---:|--------|--------------|
| 1 | **Draw** | Canvas with brush, eraser, colour picker, size, undo/redo, clear. Optional 60-second countdown to add urgency. |
| 2 | **Nickname** | Single text field (no real name needed), profanity filter. |
| 3 | **Hash** | Canvas → PNG → SHA-256, shown as a "digital fingerprint". |
| 4 | **IPFS** | Upload artwork + metadata JSON, show the CID. |
| 5 | **Mint** | Contract call; animated stages and tx hash/block number. |
| 6 | **Certificate** | Printable/shareable card with artwork, token ID, date, QR. |
| 7 | **Gallery** | New piece animates onto the live wall. |
| 8 | **Tamper (optional)** | "Try to tamper" → hash changes → ❌ verification failed. |

**UX rules:** big touch-friendly controls, auto-reset to idle after 30–45 s of inactivity, one clear call-to-action per screen, no typing beyond nickname.

---

## 3. Architecture

```text
┌───────────────────────┐        ┌──────────────────────────────┐
│ Draw Kiosk (React)    │  REST  │ Backend API (Node/Express or │
│ Canvas → PNG → SHA256 │◄──────►│ FastAPI)                     │
└───────────────────────┘        │  - validation, rate-limit    │
                                 │  - moderation state          │
┌───────────────────────┐   WS   │  - IPFS pinning              │
│ Gallery Wall (React)  │◄──────►│  - holds MINTER key (server) │
│ TV / projector        │        │  - mint queue + retry        │
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

**Design principles**
- The **server holds the minter key** — visitors never need a wallet.
- The **artwork lives on IPFS**; the **chain stores the proof** (CID + hash + creator/nickname + timestamp).
- The **verify page is a static, public site** that recomputes the hash in the browser and compares it with the on-chain value — no trust in your server.
- The gallery reads from a **DB cache** for speed and subscribes to chain events for authenticity.

---

## 4. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | **React + Vite + TypeScript**, Tailwind CSS | Fast iteration, familiar stack |
| Drawing | **HTML Canvas** (optionally `perfect-freehand` for smooth strokes) | Lightweight, exports PNG natively |
| Hashing | **Web Crypto API** (`crypto.subtle.digest('SHA-256')`) | Built-in, no dependency; same call used in the tamper demo |
| Animation | Framer Motion, confetti | Mint and "new art" effects |
| Smart contract | **Solidity 0.8.x**, OpenZeppelin **ERC721URIStorage** + AccessControl | Standard, audited building blocks |
| Dev tooling | **Hardhat** (or Foundry), TypeChain | Tests, deploy scripts, typed bindings |
| Chain client | **ethers.js v6** (backend + verify page) | Contract calls and event subscriptions |
| Network | **Sepolia** or an L2 testnet (Base Sepolia / Polygon Amoy / Arbitrum Sepolia) | Public → phones can verify; L2 = faster/cheaper. Local Hardhat as fallback. |
| IPFS | **Pinata** (primary), local **Kubo** node (fallback) | Reliable pinning + gateways; offline fallback |
| Backend | **Node + Express** (or FastAPI) | Mint queue, moderation, IPFS proxy, WebSocket |
| Realtime | **Socket.IO / WebSocket** | Push new art to the wall instantly |
| Database | **SQLite** (or PostgreSQL) | Artwork records, nickname, status, votes |
| QR | `qrcode` / `qrcode.react` | Links to `verify.<domain>/#/token/37` |
| Hosting | Verify page + gallery static on Vercel/Netlify; backend on the expo laptop (or a cheap VPS) | Public verification, local control at the booth |
| Optional wallet | MetaMask / WalletConnect | "Advanced mode": mint to the visitor's own address |

---

## 5. Smart Contract

### 5.1 Design

- **ERC-721** with `tokenURI` pointing to `ipfs://<metadataCID>`.
- On-chain struct stores the key proof fields so verification doesn't depend on metadata hosting.
- Only the **MINTER_ROLE** (the backend wallet) can mint.
- Emits an event for every mint so the gallery can listen.

### 5.2 Sketch

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract GraffitiWall is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Artwork {
        address creator;      // minter wallet or claimed visitor address
        string  nickname;
        string  ipfsCID;      // artwork image CID
        bytes32 artworkHash;  // SHA-256 of the exact PNG bytes
        uint64  timestamp;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Artwork) public artworks;

    event ArtworkMinted(
        uint256 indexed tokenId,
        address indexed creator,
        string nickname,
        string ipfsCID,
        bytes32 artworkHash
    );

    constructor() ERC721("Blockchain Graffiti Wall", "GRAFFITI") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(
        address to,
        string calldata nickname,
        string calldata ipfsCID,
        bytes32 artworkHash,
        string calldata metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256 id) {
        id = nextId++;
        _safeMint(to, id);
        _setTokenURI(id, metadataURI);
        artworks[id] = Artwork(to, nickname, ipfsCID, artworkHash, uint64(block.timestamp));
        emit ArtworkMinted(id, to, nickname, ipfsCID, artworkHash);
    }

    function verify(uint256 id, bytes32 candidateHash) external view returns (bool) {
        return artworks[id].artworkHash == candidateHash;
    }

    function supportsInterface(bytes4 i)
        public view override(ERC721URIStorage, AccessControl) returns (bool)
    { return super.supportsInterface(i); }
}
```

*(Add `Transfer` of a minted token to a visitor via the standard `transferFrom` for the "claim" flow. Keep the tests: role gating, id increment, verify true/false, event emission.)*

### 5.3 Metadata JSON (pinned to IPFS)

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

### 5.4 Optional: on-chain voting

Simple `vote(tokenId)` is possible, but costs gas per vote and needs a per-voter limit. **Recommended:** keep votes **off-chain** (DB + dedupe by device/session), then **publish the final tallies on-chain** once at the end as a signed result. Explain this trade-off to curious visitors.

---

## 6. Core Flows

### 6.1 Mint flow (sequence)

```text
Kiosk                Backend                 IPFS            Chain
  │  PNG + nickname    │                       │               │
  ├───────────────────►│ validate (size,rate)  │               │
  │                    ├── pin image ─────────►│               │
  │                    │◄──── imageCID ────────┤               │
  │                    ├── pin metadata ──────►│               │
  │                    │◄──── metaCID ─────────┤               │
  │                    ├── mint(to,nick,CID,hash,uri) ────────►│
  │                    │◄──────── tx hash / tokenId ───────────┤
  │◄── status updates (WS) ───┤                                │
  │   certificate + QR │                                       │
```

- Client computes the hash and sends it **with** the image; the **server recomputes** it from the received bytes and rejects mismatches.
- Hash the **exact bytes** that get uploaded to IPFS (don't re-encode between hashing and upload).
- Mint jobs go through a **queue with retry/backoff**; the kiosk polls/subscribes for progress.

### 6.2 Verification (public page)

```text
QR → verify page → read artwork(tokenId) from chain
   → fetch image from IPFS gateway
   → SHA-256 in browser → compare with on-chain hash
   → ✅ VERIFIED  or  ❌ FAILED
```

### 6.3 Tamper demo

1. Verify page (or kiosk) loads the original image into a canvas.
2. Button **"Try to tamper"** flips a few pixels / draws a dot.
3. Re-export → recompute SHA-256.
4. Display original vs. new hash side-by-side and run the compare → ❌.
5. Teaching line: *"The blockchain still remembers the original fingerprint — the modified copy can't pass for it."*

---

## 7. Backend API (draft)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/artworks` | Submit PNG + nickname + client hash; creates job |
| GET | `/api/artworks/:id/status` | Job stage: hashing / uploading / minting / confirmed / failed |
| GET | `/api/gallery?status=approved` | Gallery list (paginated) |
| POST | `/api/admin/artworks/:id/approve` | Moderation approve |
| POST | `/api/admin/artworks/:id/hide` | Hide from the wall |
| POST | `/api/votes` | Cast vote (rate-limited, one per category per device) |
| GET | `/api/leaderboard` | Vote tallies |
| POST | `/api/admin/reset` | Archive the day's data |
| WS | `/ws/gallery` | New/hidden artwork events |
| WS | `/ws/status/:jobId` | Mint progress for the kiosk |

### Data model

```text
artworks(id, token_id, nickname, image_cid, metadata_cid, sha256,
         tx_hash, block_number, status[pending|minted|approved|hidden|failed],
         created_at)
votes(id, artwork_id, category, voter_key, created_at)
config(key, value)            -- network mode, moderation on/off, limits
```

---

## 8. Frontend Screens

1. **Attract loop** — rotating gallery + "Draw it. Mint it. Own it."
2. **Canvas** — drawing tools + optional 60-s timer.
3. **Nickname** — single field, profanity check.
4. **Mint progress** — four-step animation with real hash/CID/tx values.
5. **Certificate** — artwork, token ID, date, QR, "download / share" buttons.
6. **Gallery wall** (TV) — grid, "NEW" highlight animation, optional vote bars.
7. **Verify page** (public) — status badge, hashes, tx link, tamper button.
8. **Admin panel** — moderation queue, hide/restore, network mode, reset, mint-queue health.

---

## 9. Implementation Plan

> Assumes 3–4 people and ~3 weeks. Scale to your TechFest date.

### Phase 0 — Setup (Days 1–2)
- [ ] Freeze scope (MVP list below), choose network (e.g. an L2 testnet), pick IPFS provider
- [ ] Create repo (`/contracts`, `/backend`, `/web-kiosk`, `/web-gallery`, `/web-verify`), env templates
- [ ] Create + fund the minter wallet (test ETH), create Pinata account/API key

### Phase 1 — Contract & pipeline (Week 1)
- [ ] `GraffitiWall.sol` + tests + deploy script (local and testnet)
- [ ] Backend: image validation, IPFS upload, mint call, DB writes
- [ ] End-to-end CLI test: PNG in → NFT minted → tokenURI resolves
- [ ] Mint queue with retry and status endpoint

### Phase 2 — Kiosk & gallery (Week 2)
- [ ] Canvas tool (brush, eraser, color, size, undo/redo, clear)
- [ ] Hashing + progress screens + certificate with QR
- [ ] Live gallery wall with WebSocket updates + new-art animation
- [ ] Admin panel with moderation queue
- [ ] Public verify page + tamper demo

### Phase 3 — Polish & optional features (Week 3)
- [ ] Voting + leaderboard (off-chain, tallies publishable on-chain)
- [ ] Idle reset, branding, sound/animation polish
- [ ] Certificate PNG/PDF download
- [ ] Local-fallback mode (Hardhat + Kubo) switchable from admin config

### Phase 4 — Hardening & rehearsal (last 3–4 days)
- [ ] Load test: 50+ rapid mints, flaky-network test, kill-switch test
- [ ] Playtest with non-technical users; shorten every step that confuses
- [ ] Failure drills: IPFS down, RPC down, wallet out of gas, Wi-Fi drop
- [ ] Pre-mint ~10 "seed" artworks so the wall isn't empty at opening
- [ ] Print posters, QR-to-gallery sign, explainer card; prepare volunteer script
- [ ] Record a fallback demo video

### Event days
- Boot checklist: balance check → contract reachable → IPFS key valid → test mint → test verify from a phone.
- Staff roles: greeter, moderator (admin panel), explainer. Archive/export data nightly.

---

## 10. MVP Scope

**Must have**
- [ ] Drawing canvas + PNG export
- [ ] SHA-256 hashing
- [ ] IPFS upload (image + metadata)
- [ ] ERC-721 contract + mint
- [ ] Live gallery wall
- [ ] QR certificate + public verify page
- [ ] **Moderation / hide control** (added; essential for a public screen)

**Strongly recommended**
- [ ] Mint progress animation + tx/block info
- [ ] Tamper demo
- [ ] Nicknames, responsive UI
- [ ] Rate limiting + retry queue

**Optional**
- [ ] Voting + leaderboard
- [ ] Visitor-owned NFTs (MetaMask / claim flow)
- [ ] Physical prizes for top artworks
- [ ] "TechFest collection" page / OpenSea-style browser

---

## 11. Booth & Hardware

```text
      ┌──────────────────────────┐
      │ TV / PROJECTOR           │
      │ LIVE NFT GALLERY         │
      └──────────────────────────┘
          💻 Draw kiosk (touch if possible)
          💻 Admin/moderator laptop
          📱 Visitor phones → verify QR
```

| Item | Notes |
|------|-------|
| Draw laptop / touchscreen (+ optional drawing tablet) | Touch makes drawing much easier |
| Gallery display (TV/projector) | HDMI + spare cable |
| Admin laptop | Moderation + monitoring |
| Reliable internet + **mobile hotspot backup** | Both IPFS and testnet RPC need it |
| Power strips, chargers | Bring spares |
| Printer (optional) | Instant paper certificates are a big hit |
| Posters, QR to the gallery | Explain the pipeline visually |

---

## 12. Risk Register

| Risk | Impact | Mitigation |
|------|:---:|-----------|
| Offensive artwork | High | Moderation queue, hide button, nickname filter |
| Internet/RPC/IPFS outage | High | Retry queue, hotspot, local fallback mode, pre-minted seed art |
| Minter wallet out of test ETH | High | Pre-fund, balance monitor in admin panel, spare wallets |
| Slow mints → queue builds | Med | Staged animation, L2 testnet, 2nd kiosk, show gallery while waiting |
| Visitors can't open the verify page | Med | Public static hosting; QR also encodes a short URL |
| Hash mismatch bugs (re-encoding) | Med | Hash exact uploaded bytes; server recomputes and compares |
| Spam / abuse | Med | Rate limits, size cap, admin kill switch |
| Misunderstanding of NFT/"ownership" | Low | Explainer card: art on IPFS, proof on chain, testnet = no real value |

---

## 13. Success Metrics

- Artworks minted per hour / per day
- Median time from "Start" to certificate
- Mint success rate and retry count
- QR scans / verify-page visits
- Votes cast, repeat visitors
- Club sign-ups, social posts/tags
- Qualitative: "Can you explain what the hash proves?"

---

## 14. Stretch Goals

- **Break-the-Chain side demo:** a 4-block hash chain where editing one block invalidates the rest (great queue-filler).
- **Two-station setup** with a shared gallery.
- **Collaborative mural:** several visitors each draw a tile of one big NFT.
- **Claim to your own wallet** via QR + MetaMask/WalletConnect after the event.
- **AR/phone preview** of the certificate.
- **Printed "proof of existence" card** with the QR code.

---

## 15. Final Demo Script (≈ 90 seconds)

```text
Draw artwork → Hash it → Pin to IPFS → Mint NFT → Tx confirmed
→ QR certificate → Appears on live wall → Tamper → Hash changes → ❌ Verification fails
```

**Key message to visitors:**
> *Creation → Cryptographic proof → Decentralized storage → Blockchain record → Verification.*
