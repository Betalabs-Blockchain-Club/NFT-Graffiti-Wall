# AGENT.md — Root Orchestrator (NFT Graffiti Wall)

This file tells any human member or AI agent how the whole repo fits together, who owns what, and what cross-folder contracts must never break.

Source vision: [`nft_graffiti_wall_plan.md`](./nft_graffiti_wall_plan.md). User-facing guide: [`README.md`](./README.md).

## 1. Purpose

Coordinate 5 runtime services + shared lib + ops so that the pipeline `DRAW → HASH → IPFS → MINT → VERIFY → LIVE GALLERY` works end-to-end in 60–120s at a live expo with unreliable Wi-Fi.

## 2. Folder ownership (who does what)

| Folder | Owner agent/member | Function in one line |
|--------|-------------------|----------------------|
| `contracts/` | Contract agent | Owns `GraffitiWall.sol`, tests, deploys. Sole writer of on-chain truth. |
| `backend/` | Backend agent | Owns validation, IPFS pinning, mint queue, DB, WS, admin API. Sole holder of `MINTER_PRIVATE_KEY`. |
| `web-kiosk/` | Kiosk agent | Draw → nickname → progress → certificate. Produces PNG + client hash. |
| `web-gallery/` | Gallery agent | TV wall. Consumes gallery API + WS. Never mints. |
| `web-verify/` | Verify agent | Public static verification + tamper demo. Reads chain + IPFS directly, never backend. |
| `web-admin/` | Admin agent | Moderation (approve/hide), kill switch, network mode. |
| `shared/` | Shared-lib agent | Hashing, canvas export, api-client, types, QR. Framework-free. |
| `docs/` | Docs agent | Architecture, API, checklists, demo script. |
| `scripts/` | Scripts agent | e2e-mint, seed, export. |
| `infra/` | Infra agent | Docker, hosting, CI. |

> Each folder's `AGENT.md` is authoritative for that folder. This root file is authoritative for boundaries.

## 3. Global input → output contract

**Global input:** visitor drawing (PNG bytes ≤500KB) + nickname (≤32 chars).
**Global output:** (a) ERC-721 token with on-chain `{ipfsCID, artworkHash, nickname, timestamp}`, (b) IPFS image + metadata CIDs, (c) QR certificate linking to `verify/#/token/{id}`, (d) gallery event on WS.

**The bytes hashed must be the bytes pinned must be the bytes verified.** Any re-encode between steps is a P0 bug.

## 4. Cross-service interfaces (do not break)

1. **Backend REST** — `POST /api/artworks {imageBase64|multipart, nickname, clientHash}` → `{jobId, status}`. `GET /api/artworks/:id/status`. `GET /api/gallery?status=approved`. See `backend/AGENT.md` + `docs/api.md`.
2. **WS** — `/ws/gallery {type: new|hide, artwork}` and `/ws/status/:jobId {stage, txHash, tokenId, error}`.
3. **Chain** — `mint(to, nickname, ipfsCID, artworkHash, metadataURI)`, `verify(id, hash)`, `ArtworkMinted` event. See `contracts/AGENT.md`.
4. **Verify deep-link** — `{VERIFY_BASE}/#/token/{tokenId}`. QR encodes exactly this. All frontends use `shared/src/qr`.
5. **Shared types** — `Artwork, MintJob, GalleryItem, VerifyResult` in `shared/src/types`. Backend and frontends must use them, not redefine.

## 5. Hard rules

- Only `backend/` ever sees `MINTER_PRIVATE_KEY` / `PINATA_JWT`. Frontends use `VITE_*` public vars only.
- `shared/` must not import from `backend/` or `web-*`. It must be importable by both Node and browser.
- Hash = SHA-256 of exact PNG bytes. Client pre-computes, server recomputes, verify page recomputes. One implementation in `shared/src/hashing`.
- Moderation status enum is `pending|minted|approved|hidden|failed`. Gallery shows `approved` only. Admin is the only writer of `approved|hidden`.
- Contract address change → update `backend/.env CONTRACT_ADDRESS` + all `VITE_CONTRACT_ADDRESS` + `docs/contract.md`. Announce in PR.
- No `.env` commits. `.env.example` is the schema.

## 6. Definition of done (repo-level)

- [ ] `npx hardhat test` passes in `contracts/`
- [ ] `scripts/e2e-mint.js PNG NICK` → tokenId + `✅ VERIFIED` via verify logic
- [ ] Kiosk → backend → gallery WS → verify QR works on testnet with phone on cellular
- [ ] Admin hide removes from gallery in <3s
- [ ] Kill switch stops new mints but gallery stays up
- [ ] Local fallback `docker compose up` works with no internet (Hardhat + Kubo)

## 7. How members work together

1. Read this file + your folder's `AGENT.md` before coding.
2. Branch per service: `feat/<folder>-<thing>`. Example: `feat/kiosk-canvas`.
3. Changing a shared interface (REST shape, WS event, Solidity signature, shared type, QR URL) → open a PR labeled `contract-change`, update `docs/api.md` or `docs/contract.md`, and tag affected folder owners.
4. `shared/` PRs need backend + 1 frontend reviewer.
5. Daily in final week: run e2e-mint + phone verify, post results.

## 8. Non-goals

- No mainnet. Testnet / localhost only.
- No visitor wallets in MVP (claim flow is stretch).
- No on-chain voting in MVP (off-chain votes, publish tally at end).
