# AGENT.md — `web-kiosk/` (Draw Station)

## 1. Purpose / Function
The visitor-facing mint terminal. Turns 60 seconds of drawing into a QR certificate. Must be touch-friendly, foolproof, and fast — one CTA per screen, auto-reset on idle.

## 2. Inputs
- Touch/mouse strokes on `<canvas>` (brush, eraser, colour, size, undo/redo, clear, optional 60-s timer).
- `nickname` (1–32 chars, profanity-filtered via `shared`).
- Backend: `POST /api/artworks`, `GET /status`, `WS /ws/status/:jobId`.
- Env (public only): `VITE_API_URL, VITE_WS_URL, VITE_VERIFY_URL, VITE_EVENT_NAME`.

## 3. Outputs
- PNG bytes (exact bytes hashed + uploaded — **never re-encode** between `canvas.toBlob` → hash → upload).
- `clientHash` (SHA-256 hex via `shared/src/hashing`).
- Screens: Attract → Canvas → Nickname → MintProgress (Hashing→Uploading→Minting→Confirmed) → Certificate `{artwork, tokenId, txHash, QR}`.
- Idle reset event after 30–45s → back to Attract.

## 4. Functions / Responsibilities
1. `components/DrawingCanvas.tsx` — canvas + tools + export `toBlob('image/png')`.
2. `pages/Nickname.tsx` — single field, client filter, no PII.
3. `hooks/useMintJob.ts` — POST art, poll/subscribe status, expose `{stage, progress, error, retry}`.
4. `components/MintProgress.tsx` — 4-step animation with real hash/CID/tx values.
5. `components/CertificateCard.tsx` — artwork + tokenId + date + QR (`shared/qr` → `${VITE_VERIFY_URL}/#/token/{id}`) + download/share.
6. Never store minter keys; size-check ≤500KB before upload; rate-limit UX (disable double-submit).

## 5. Interfaces
- Consumes backend REST/WS (see `docs/api.md`). Sends `clientHash`; backend recomputes — mismatch is a kiosk bug, fix export path.
- Consumes `shared`: `hashing.sha256Bytes`, `canvas.exportPNG`, `api-client.submitArtwork`, `types.MintJob`.
- Produces QR URL consumed by `web-verify`.

## 6. Dependencies
- React + Vite + TS, Tailwind, Framer Motion, `qrcode.react`, `perfect-freehand` (optional).
- Needs backend reachable; works degraded (show queue position) if mint slow.

## 7. File layout
```text
web-kiosk/
├── AGENT.md
├── src/components/DrawingCanvas.tsx
├── src/components/MintProgress.tsx
├── src/components/CertificateCard.tsx
├── src/pages/Attract.tsx
├── src/pages/Draw.tsx
├── src/pages/Nickname.tsx
├── src/hooks/useMintJob.ts
└── src/lib/config.ts
```

## 8. Definition of Done
- [ ] Draw → nickname → progress → certificate in <120s on testnet.
- [ ] Hash shown matches backend `sha256` + verify page recompute.
- [ ] Idle 40s resets without stuck WS. Double-tap submit creates 1 job.
- [ ] QR scans from phone → verify ✅.

## 9. Non-goals
- No gallery logic here. No admin controls. No wallet connect in MVP.

## 10. Member guide
1. `npm install && npm run dev` (needs `VITE_API_URL`).
2. Implement `DrawingCanvas` export path first, then `useMintJob`, then progress/cert.
3. Test with expo touchscreen size (big buttons ≥48px).
