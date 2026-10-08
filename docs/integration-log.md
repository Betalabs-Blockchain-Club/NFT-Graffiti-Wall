# Local Integration Log

## 2026-10-08 — I1 wiring pass

- Aligned kiosk and gallery defaults with the backend at `http://localhost:3001`.
- Assigned kiosk port `5173` and gallery port `5174`; both Vite apps now read the root `.env`.
- Made the artwork submit response match the shared API contract (`202 {jobId, status: "pending"}`).
- Switched gallery API items to the shared `GalleryItem` type and resolve `ipfs://` CIDs through the configured gateway.
- Included `db/schema.sql` in the backend container image; the first container launch exposed that the compiled service could not find it.
- Kiosk, gallery, and backend production builds pass. The local Hardhat + Kubo + containerized backend flow passed E1: token `1`, image CID `bafkreihk6rk3dkljy3qzejgzbvlpdj6zhhnl633g7gje5vydv2heiebfsu`, and `verify()` returned true.
- Exercised the admin REST endpoints: minted art stayed private, approve published it, hide removed it. `/api/health` reported chain and IPFS healthy.
- Vite served the kiosk on `5175` because its configured `5173` port was occupied during the check; the gallery used `5174`.

## Full-loop status

The local chain → backend → IPFS → moderation API → public gallery API flow passed. The root `.env` is absent, so the test used temporary local Hardhat/Kubo settings and a temporary SQLite DB. `web-admin/` currently contains only its package manifest and instructions, so its UI could not be run; no browser-mediated full loop is claimed.

Complete A1/A2 to run the browser-admin portion, then exercise the flow through kiosk and gallery browsers. For a persistent setup, add valid local settings to the ignored root `.env` and deploy the contract again after restarting Hardhat.
