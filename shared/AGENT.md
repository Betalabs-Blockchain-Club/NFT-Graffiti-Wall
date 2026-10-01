# AGENT.md — `shared/` (Cross-App Library)

## 1. Purpose / Function
Single source of truth for logic used in ≥2 places. Prevents the #1 expo bug: hash mismatch from duplicated implementations. Must stay **framework-free** (no React, no Express, no Node-only APIs except shims).

## 2. Inputs
- Raw PNG `Uint8Array` / `Blob`, nicknames, backend DTOs, tokenIds.

## 3. Outputs (consumed by all)
- `hashing.sha256Bytes(bytes) -> hex` (browser WebCrypto + Node fallback, identical output).
- `canvas.exportPNG(canvas) -> Blob` + `blobToBytes()` — exact bytes, no re-encode.
- `api-client` — typed `submitArtwork, getStatus, getGallery, approve, hide`.
- `types` — `Artwork, MintJob, GalleryItem, VerifyResult, JobStage, ApiError`.
- `qr.buildVerifyUrl(base, tokenId)` + `parseTokenId(url)`.

## 4. Functions / Responsibilities
1. `hashing/` — one impl, tested with vector `SHA256("abc") = ba7816bf...`. Export `sha256Hex`, `verifyHash`.
2. `canvas/` — export + size check + downscale helper (keep ≤500KB without changing hashed bytes unexpectedly — hash **after** final encode).
3. `api-client/` — fetch wrapper with base URL injection, zod validation,typed errors.
4. `types/` — zod schemas + TS types; backend + frontends import, never redefine.
5. `qr/` — URL builder; changing format = major version + reprint QRs.

## 5. Interfaces
- Pure functions + types only. No env reads, no secrets.
- Must work in browser (Vite) AND Node (backend) — test both.

## 6. Dependencies
- None runtime (zod optional). Dev: vitest, typescript.

## 7. File layout
```text
shared/
├── AGENT.md
├── package.json
└── src/
    ├── hashing/index.ts
    ├── canvas/index.ts
    ├── api-client/index.ts
    ├── types/index.ts
    └── qr/index.ts
```

## 8. Definition of Done
- [ ] `npm test` passes in Node + browser (hash vector, PNG round-trip, URL parse).
- [ ] Kiosk hash == backend recompute == verify recompute for same file.
- [ ] No import from `backend/` or `web-*` (lint enforced).

## 9. Non-goals
- No UI components, no chain calls, no IPFS calls.

## 10. Member guide
1. Edit here only if ≥2 apps need it. Otherwise keep logic local.
2. Any change needs backend + 1 frontend reviewer + `npm test`.
