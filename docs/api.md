# API Reference (mirrors `backend/src/routes/`)

Base: `VITE_API_URL` (dev `http://localhost:3001`).

## POST /api/artworks → 202 {jobId, status:'pending'}
Multipart: `image` (PNG ≤500KB), `nickname` (1–32), `clientHash` (hex64). Header `X-Device-Id`.
Errors: 400 hash-mismatch/oversize, 429 rate-limit, 503 kill-switch.

## GET /api/artworks/:jobId/status → MintJob
`{jobId, stage: hashing|uploading|minting|confirmed|failed, tokenId?, txHash?, imageCID?, error?}`

## GET /api/gallery?status=approved&limit=48&cursor= → {items: GalleryItem[], nextCursor}
Only `approved` is public. Requires no auth.

## POST /api/votes {artworkId, category, voterKey} → 201
Dedupe `(artworkId, category, voterKey)` → 409 on double-vote.

## Admin (Bearer ADMIN_TOKEN)
- POST /api/admin/artworks/:id/approve|hide
- PUT /api/admin/config {MODERATION_MODE, KILL_SWITCH, IPFS_PROVIDER}
- POST /api/admin/reset {confirm: "ARCHIVE YYYY-MM-DD"}
- GET /api/health → {ok, chain, ipfs, queueDepth, balanceEth}

## WS /ws/gallery — {type:'new'|'hide', artwork}
## WS /ws/status/:jobId — MintJob updates
