# API Reference (mirrors `backend/src/routes/`)

Base: `VITE_API_URL` (dev `http://localhost:3001`).

## POST /api/artworks → 202 {jobId, status:'pending'}
Multipart: `image` (PNG ≤500KB), `nickname` (1–32), `clientHash` (hex64). Header `X-Device-Id`.
Errors: 400 hash-mismatch/oversize, 429 rate-limit, 503 kill-switch.

## GET /api/artworks/:jobId/status → MintJob
`{jobId, stage: hashing|uploading|minting|confirmed|failed, tokenId?, txHash?, imageCID?, error?}`

## GET /api/gallery?status=approved&limit=48&cursor= → {items: GalleryItem[], nextCursor}
`approved` is public and requires no auth. Any other `status` requires `Authorization: Bearer <ADMIN_TOKEN>`.

## POST /api/votes {artworkId, category, voterKey} → 201
Dedupe `(artworkId, category, voterKey)` → 409 on double-vote.

## Admin (Bearer ADMIN_TOKEN)
- POST /api/admin/artworks/:id/approve|hide
- PUT /api/admin/config {MODERATION_MODE, KILL_SWITCH, IPFS_PROVIDER}
- POST /api/admin/reset {confirm: "ARCHIVE YYYY-MM-DD"}
- GET /api/health → {ok, chain, ipfs, queueDepth, balanceEth}

## Socket.IO realtime
Connect to the Socket.IO server and use these namespaces:

- `/gallery`: server emits `new` with a `GalleryItem`; server emits `hide` with `{id}`.
- `/status`: client emits `subscribe` with `jobId`; server emits `job` with a `MintJob`.

Clients may poll `GET /api/artworks/:jobId/status` as a fallback.

`GalleryItem` is `{id, tokenId?, nickname, imageCID, imageUrl, sha256, status, createdAt}` where `status` is `pending | minted | approved | hidden`.
