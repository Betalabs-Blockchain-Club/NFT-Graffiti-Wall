# API Reference

The production API is the Express app in `backend/src/`. Base URL for local development: `http://localhost:3001`. JSON errors use `{ "code": string, "message": string }` unless noted. Server failures return a generic `internal-error`; provider details and secrets are not returned.

## Artwork submission and status

### `POST /api/artworks` → `202`

Multipart form fields:

| Field | Required | Rules |
|---|---|---|
| `image` | yes | One PNG file, valid PNG signature, at most `MAX_IMAGE_KB` (default 500 KB). Bytes are hashed and pinned unchanged. |
| `nickname` | yes | 1–32 characters after trimming; blocked language is rejected. |
| `clientHash` | yes | SHA-256 of the exact image bytes, exactly 64 hexadecimal characters, without a `0x` prefix. |

Send `X-Device-Id` for per-device rate limiting. If absent, the backend uses the request IP. `RATE_LIMIT_PER_MIN` defaults to 5. The fixed-window limiter is process-local. The kiosk also sends a stable `Idempotency-Key` for this submission; replaying the same key and payload returns the original job, while reusing it for different content returns `409`. Success body: `{ "jobId": "<uuid>", "status": "pending" }`.

Common errors: `400` (`missing-image`, `invalid-upload`, `invalid-png`, `invalid-nickname`, `invalid-hash`, `hash-mismatch`), `413 oversize`, `429 rate-limit` (includes `Retry-After`), `503 kill-switch`.

### `GET /api/artworks/:jobId/status` → `200 MintJob`

Returns `{ jobId, stage, tokenId?, txHash?, imageCID?, metadataCID?, retry?, error? }`. `stage` is `hashing | uploading | minting | confirmed | failed`; `retry` is the current retry index (starts at 0). Treat `error` as diagnostic and show visitors a friendly message. Job progress is in memory: an unknown ID returns `404 not_found`; after a restart, a persisted artwork may instead return `404` with a message that status is unavailable.

## Gallery and voting

### `GET /api/gallery?status=approved&limit=48&cursor=...` → `200`

Returns `{ items: GalleryItem[], nextCursor: string | null }`. `status` defaults to `approved`; that public view requires no token. Other supported statuses (`pending`, `minted`, `hidden`) require `Authorization: Bearer <ADMIN_TOKEN>`. `limit` is a positive integer up to the storage layer's maximum (100); `cursor` is an opaque pagination cursor. `GalleryItem` contains `id`, optional `tokenId`, `nickname`, `imageCID`, `imageUrl` (`ipfs://<CID>`), `sha256` (hex without `0x`), `status`, and `createdAt`.

### `POST /api/votes` → `201 { "ok": true }`

JSON body: `{ "artworkId": string, "category": string, "voterKey": string }`. A duplicate `(artworkId, category, voterKey)` returns `409`; an unknown or non-approved artwork returns `404`. `GET /api/leaderboard` returns the stored aggregate. Vote submissions are not currently rate-limited by the backend.

## Admin (Bearer `ADMIN_TOKEN`)

- `POST /api/admin/artworks/:jobId/mint` → `{ item: GalleryItem, job: MintJob }`; submits a prepared artwork to the chain, marks it `approved` after receipt, and emits gallery `new`.
- `POST /api/admin/artworks/:jobId/retry-ipfs` → `{ job: MintJob }`; retries failed IPFS preparation while the backend still has the uploaded bytes.
- `POST /api/admin/artworks/:jobId/restore` → `{ item: GalleryItem }`; republishes an already minted hidden artwork.
- `POST /api/admin/artworks/:jobId/hide` → `{ item: GalleryItem }`; changes it to `hidden` and emits gallery `hide` (`{ id }`).
- `PUT /api/admin/config` → current config. JSON may include `KILL_SWITCH` (boolean) and/or `IPFS_PROVIDER` (`pinata | kubo`). Legacy `MODERATION_MODE` values remain accepted for existing deployments but no longer change the mint flow.
- `POST /api/admin/reset` with `{ "confirm": "ARCHIVE YYYY-MM-DD" }` for **today's UTC date** → `{ ok, archiveId, artworkCount, voteCount }`. The route archives all current artwork and votes; wrong confirmation is rejected.
- `POST /api/admin/clear-gallery` with `{ "confirm": "CLEAR GALLERY" }` → archives approved gallery artwork and its votes, then emits gallery `hide` events.
- `POST /api/admin/clear-mint-requests` with `{ "confirm": "CLEAR MINT REQUESTS" }` → cancels and archives pending submissions. Requests already minting stay active; response includes `skippedMintingCount`.

Unauthenticated admin requests return `401`. The kill switch blocks new artwork submissions; reads and the gallery remain available.

## Health

### `GET /api/health` → `200`

Returns `{ ok, chain, ipfs, queueDepth, balanceEth }`. `ok` is true only when chain and IPFS checks succeed and queue/balance values are valid. Individual failed checks are `false`; health remains `200` and does not expose provider errors or credentials.

## Socket.IO

Connect to the backend origin using Socket.IO:

- Namespace `/gallery`: server emits `new` with an approved `GalleryItem`; emits `hide` with `{ id }`.
- Namespace `/status`: client emits `subscribe` with a `jobId`; server emits `job` with that job's `MintJob` updates.

Subscriptions are not authorization and updates are not replayed to late subscribers. The job progresses through hashing, uploading, ready, minting, and confirmed (or failed). Reconnect, subscribe again, and poll `GET /api/artworks/:jobId/status` to recover current state. Browser origins are controlled by `CORS_ORIGIN`.
