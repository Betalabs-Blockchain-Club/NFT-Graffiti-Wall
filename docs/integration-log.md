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

## 2026-10-08 — I2 Polygon Amoy preflight

- I2 cannot start from this checkout: no `contracts/deployments/polygon-amoy.json` or public verify-site URL is available for the kiosk configuration. No credential values were requested in chat or added to the repository.
- The V3 static-host deliverables are also absent: `web-verify/README.md` and a deployed site are not present. The current verify app has no tamper page/control, so the requested phone tamper check cannot be completed yet.
- No Polygon Amoy transaction, Pinata upload, public URL check, or cellular phone scan was run. The local Hardhat/Kubo result above does not count as I2 evidence.
- To resume: provide local Amoy settings in the ignored `.env` (funded minter key, RPC URL, deployed contract address, Pinata JWT, and public verify URL); complete/deploy V3 with the same public RPC and contract address; then run E1 and scan the resulting QR on a phone using cellular data, including the tamper flow. Keep secrets out of this log.
