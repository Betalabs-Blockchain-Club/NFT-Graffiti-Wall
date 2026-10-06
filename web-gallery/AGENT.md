# AGENT.md — `web-gallery/` (Live Wall TV)

## 1. Purpose / Function
Crowd magnet on TV/projector. Shows approved art grid with NEW animation + optional vote bars. Read-only; never mints, never moderates.

## 2. Inputs
- `GET /api/gallery?status=approved&limit&cursor` (paginated, poll every 10s as fallback).
- Socket.IO `/gallery` namespace: `new` (`GalleryItem`) and `hide` (`{id}`).
- Env: `VITE_API_URL, VITE_WS_URL`.

## 3. Outputs
- Fullscreen grid: artwork image (via `VITE_IPFS_GATEWAY/<cid>`), nickname, tokenId, NEW highlight, vote counts.
- Attract overlay when empty: "Draw it. Mint it. Own it." + QR to kiosk queue info.

## 4. Functions / Responsibilities
1. `pages/Wall.tsx` — grid layout, responsive for 1080p projector.
2. `components/GalleryGrid.tsx` — virtualized if >100 items, lazy images.
3. `hooks/useGallerySocket.ts` — WS subscribe + REST backfill + dedupe by `tokenId`.
4. `components/NewArtToast.tsx` — confetti + zoom-in on `new` event.
5. Handle `hide` by removing instantly (no flicker).

## 5. Interfaces
- Consumes backend gallery API + WS only. Never calls chain/IPFS pinning directly (reads via gateway).
- Uses `shared/types.GalleryItem`.

## 6. Dependencies
- React + Vite + TS, Tailwind, Framer Motion, canvas-confetti, Socket.IO client.

## 7. File layout
```text
web-gallery/
├── AGENT.md
├── src/pages/Wall.tsx
├── src/components/GalleryGrid.tsx
├── src/components/NewArtToast.tsx
└── src/hooks/useGallerySocket.ts
```

## 8. Definition of Done
- [ ] New approved art appears in <3s with animation; hide disappears in <3s.
- [ ] Survives backend restart (reconnect + backfill, no duplicates).
- [ ] 200+ items render smoothly on expo laptop.

## 9. Non-goals
- No mint, no verify logic, no moderation buttons.

## 10. Member guide
1. `npm run dev`, point at backend, open 2 windows to test WS.
2. Seed with `scripts/seed-wall.js` before styling.
