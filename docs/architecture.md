# Architecture

## Services and data flow

```text
 Kiosk (untrusted browser) ── multipart PNG + nickname + SHA-256 ──┐
                                                                   ▼
 Gallery (read-only) ◄── REST + Socket.IO ── Backend API ── SQLite cache
                                             │          │
                                             │          ├── exact PNG + metadata ──► IPFS
                                             │          └── mint + event ──────────► EVM chain
                                             │
 Staff/operator API client ── authenticated moderation/config ─────┘

 Visitor phone ── QR ──► Static verify page ── read artwork/verify ──► EVM chain
                                         └── fetch image bytes ──────► IPFS gateway
```

1. The kiosk exports a PNG, hashes its exact bytes with SHA-256, and submits those same bytes with the nickname and hash.
2. The backend validates file signature, size, nickname, and hash; creates a job and artwork record; pins the original bytes and metadata to IPFS; then asks the chain service to mint. The queue retries transient IPFS/chain failures up to three times. The job state is currently held in process memory; SQLite stores artwork/gallery state, not resumable queue payloads.
3. The backend stores the confirmed token/CIDs/transaction in SQLite. Moderation determines whether the artwork waits in `minted` or becomes `approved`. Approved and hidden changes are broadcast to the gallery. Kiosk progress is pushed over Socket.IO and can be recovered by polling the status endpoint while the process retains the job.
4. The certificate QR links to `web-verify/#/token/{tokenId}`. The verify page reads the artwork hash from the contract, downloads image bytes from an IPFS gateway, recomputes SHA-256, and compares locally. It does not call the backend.

## Trust boundaries

- **Kiosk, gallery, admin API client, and visitor phone are client-controlled.** Validate all input at the backend; never put `MINTER_PRIVATE_KEY`, `PINATA_JWT`, or `ADMIN_TOKEN` in a `VITE_*` variable or static bundle. The repository does not currently include a runnable admin UI.
- **Backend is trusted to validate, pin, submit transactions, and moderate, but is not the verification authority.** It holds the minter key and Pinata credential. Admin routes require `Authorization: Bearer <ADMIN_TOKEN>`; public health and approved-gallery reads do not.
- **The EVM contract is the source for the token's recorded nickname, image CID, artwork hash, timestamp, and ownership.** The chain cannot prove that the original submitted pixels were appropriate or that a trusted operator reviewed them.
- **IPFS provides content-addressed bytes, not guaranteed availability or correctness.** Gateways can fail or be censored. Verification only succeeds when the fetched bytes hash to the on-chain value.
- **SQLite is a backend gallery/moderation cache, not independent proof.** A backend restart preserves artwork records, but the current in-memory mint queue/status map is not a durable job system.
- **Socket.IO is a best-effort notification channel, not durable history or authorization.** Clients poll REST for current job status and refetch gallery pages after reconnecting.

## Failure and operating behavior

- Chain/IPFS failures retry jobs and eventually produce `failed`; show that state clearly and retain the returned job ID for support. Do not imply an offline submission was durably queued.
- `GET /api/health` reports chain/IPFS readiness, queue depth, and minter balance without returning provider errors or secrets. A failing dependency makes `ok` false while the endpoint itself remains readable.
- `KILL_SWITCH=true` rejects new mint submissions with `503` but leaves health and gallery reads online.
- Local fallback runs Hardhat + Kubo + backend with Docker Compose; deploy the contract to the local Hardhat node before starting the backend. See the README quickstart and [`docs/booth-checklist.md`](./booth-checklist.md).
