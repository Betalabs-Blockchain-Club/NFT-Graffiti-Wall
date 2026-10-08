# AGENT.md — `backend/` (Mint Pipeline API)

## 1. Purpose / Function
The **only trusted writer**: validates drawings, pins to IPFS, queues + retries mints, stores DB cache, broadcasts WS events, enforces moderation/rate-limits. Holds `MINTER_PRIVATE_KEY` + `PINATA_JWT`. Frontends never mint directly.

## 2. Inputs (from kiosk/admin/gallery)
- `POST /api/artworks` — multipart `{image: PNG ≤MAX_IMAGE_KB, nickname: string 1–32, clientHash: hex64}` + headers `X-Device-Id`.
- `GET /api/artworks/:jobId/status`, `GET /api/gallery?status=approved&limit&cursor`.
- `POST /api/admin/*` — Bearer `ADMIN_TOKEN`: approve/hide/reset/mode.
- `POST /api/votes {artworkId, category, voterKey}`.
- Socket.IO: namespace `/gallery` emits `new` (`GalleryItem`) and `hide` (`{id}`); namespace `/status` accepts `subscribe(jobId)` and emits `job` (`MintJob`).
- Env: `RPC_URL, CONTRACT_ADDRESS, MINTER_PRIVATE_KEY, PINATA_JWT|KUBO_API, DATABASE_URL, MODERATION_MODE, KILL_SWITCH`.

## 3. Outputs (to chain/IPFS/DB/frontends)
- IPFS: `imageCID`, `metadataCID` (`{name, description, image: ipfs://.., attributes:[Creator, SHA-256, Event]}`).
- Chain: `mint()` tx → `{tokenId, txHash, blockNumber}`.
- DB row `artworks(status, token_id, tx_hash, cids, sha256, nickname)`.
- REST `{jobId, status, tokenId?, txHash?, error?}` + WS events `{type: job|new|hide, ...}`.
- Stage machine: `hashing → uploading → minting → confirmed | failed`.

## 4. Functions / Responsibilities
1. **Validation** (`middleware/`): PNG magic bytes, size cap, nickname trim + profanity filter, `clientHash` recompute — mismatch → 400 (P0 if skipped).
2. **IPFS service** (`services/ipfs.ts`): Pinata primary → Kubo fallback; pin image first, then metadata; return CIDs.
3. **Queue** (`services/queue.ts`): in-memory/BullMQ FIFO, concurrency 1–2, exponential backoff 3 retries, idempotency by `jobId`, `/queue health` for admin.
4. **Chain service** (`services/chain.ts`): ethers v6 signer, `mint()`, wait 1 conf, listen `ArtworkMinted` to backfill gallery.
5. **DB** (`db/`): SQLite (`schema.sql`): `artworks, votes, config`. Gallery reads cache, not chain.
6. **WS** (`ws/`): broadcast `new` (approved only) + `hide`; per-job progress.
7. **Admin**: approve/hide/reset, `MODERATION_MODE` (`display_after_approve` vs `mint_after_approve`), `KILL_SWITCH` (stop new jobs, keep reads).
8. **Votes**: off-chain, one per `(voterKey, category)`, leaderboard aggregate.

## 5. Interfaces (contracts with other folders)
- REST/WS shapes in `docs/api.md` — changing them = `contract-change` PR + update `shared/src/api-client`.
- Emits QR target: `tokenId` must match verify deep-link `/#/token/{id}`.
- Consumes contract ABI from `contracts/artifacts`; consumes `shared/src/types` (do not duplicate types).

## 6. Dependencies
- Node 20, Express, ethers v6, Pinata SDK / kubo-rpc-client, sqlite (better-sqlite3), Socket.IO, zod.
- Needs: contract address (from `contracts/`), IPFS reachable, minter funded with test POL on Amoy.

## 7. File layout
```text
backend/
├── AGENT.md
├── package.json
├── src/
│   ├── index.ts              # express + ws bootstrap
│   ├── routes/artworks.ts    # POST /api/artworks, GET status
│   ├── routes/gallery.ts     # GET /api/gallery
│   ├── routes/votes.ts
│   ├── routes/admin.ts
│   ├── services/ipfs.ts
│   ├── services/chain.ts
│   ├── services/queue.ts
│   ├── services/storage.ts   # DB writes
│   ├── ws/gallery.ts
│   ├── ws/jobStatus.ts
│   ├── db/schema.sql
│   ├── db/client.ts
│   ├── middleware/rateLimit.ts
│   ├── middleware/validate.ts
│   ├── middleware/adminAuth.ts
│   ├── config/env.ts
│   ├── config/networks.ts
│   └── utils/hash.ts         # re-export shared hashing (node impl)
└── tests/e2e-mint.test.ts
```

## 8. Definition of Done
- [ ] PNG in → recomputed hash → CIDs → tokenId → gallery WS → `GET status=confirmed`.
- [ ] Hash mismatch rejected; oversize rejected; rate-limit 429; kill switch 503 for POST only.
- [ ] IPFS down → job retries, kiosk shows `uploading (retry 2/3)`, no data loss.
- [ ] Hide removes from gallery in <3s; non-approved never in `?status=approved`.
- [ ] No secret in logs/responses. `GET /api/health` shows `{chain, ipfs, queueDepth, balance}` without secrets.

## 9. Non-goals
- No image re-encoding (store exact bytes). No frontend secrets. No on-chain votes.

## 10. Member guide
1. `cp ../.env.example ../.env`, `npm install`, `npm run dev`.
2. Start with `routes/artworks.ts` → `services/ipfs.ts` → `services/queue.ts` → `services/chain.ts`.
3. Always `shared` types for `Artwork/MintJob`. Test with `scripts/e2e-mint.js`.
