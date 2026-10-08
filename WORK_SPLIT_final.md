# WORKSPLIT.md - Agent work split for NFT Graffiti Wall

> **Audience: AI coding agents (and humans briefing them).** This file is the single source of truth for *who builds what, in which files, against which interfaces*. Read it **after** the root `AGENT.md` and **before** the `AGENT.md` of the folder you work in. If this file conflicts with a folder `AGENT.md` or `docs/api.md`, **this file wins** (Member 4 reconciles the docs in task X0).

## 0. How to use this file

1. Find your **task ID** (it is in your GitHub issue title, e.g. `[B2] ...`).
2. Read section 1 (rules), section 2 (frozen decisions), then **only your task block in section 6**.
3. Build inside the files your task *OWNS*. Do not touch anything else.
4. Follow the protocol in section 7, then open a PR.

An agent works on **one task at a time**. A task block is self-contained: it lists its owner, dependencies, files, interface, steps, how to test alone, and the exact conditions for being done.

## 1. Hard rules (MUST / MUST NOT)

1. **MUST** edit only paths listed under your task's `OWNS`. Creating new files *inside* an owned path is fine. **MUST NOT** edit any other file, including `package-lock.json` by hand (use `npm install -w <workspace> <pkg>` to add dependencies; if the lockfile conflicts on rebase, delete it from the diff and rerun `npm install`).
2. **MUST NOT** wait for, import from, or depend on another task's unfinished work **when your task is `INDEPENDENT`**. Use the stub/mock named under `TEST ALONE`.
3. **MUST** implement the *Interface* exactly as written (names, argument shapes, return shapes, status codes). Member 4 wires modules together using these signatures; any deviation breaks integration silently.
4. **MUST** respect the frozen decisions in section 2. **MUST NOT** re-decide them. If you believe one is wrong, stop and comment on the issue with the reason and a proposal; do not implement a different version.
5. **MUST NOT** read `process.env` inside library modules (backend modules receive config as arguments; only `backend/src/config/**` and Vite `import.meta.env` in apps read env).
6. **MUST NOT** commit secrets (`.env`, `MINTER_PRIVATE_KEY`, `PINATA_JWT`, `ADMIN_TOKEN` values) or log them. **MUST NOT** return them in any response.
7. **MUST NOT** modify `contracts/contracts/GraffitiWall.sol`. A contract change is a separate issue labelled `contract-change`.
8. **MUST NOT** re-encode, resize or otherwise alter image bytes after they are hashed. The bytes hashed = the bytes uploaded = the bytes pinned.
9. **MUST** write tests for your task and run them before opening a PR. Tests live next to the code or in the folder's existing test dir.
10. **MUST** keep one task per branch and one task per PR.
11. **When the spec is silent:** pick the simplest behaviour consistent with `docs/api.md` and the folder `AGENT.md`, state it under *Assumptions* in the PR description, and continue. Do not ask for permission for small gaps; do stop and comment for anything that changes an interface.

## 2. Frozen decisions

- **Realtime = Socket.IO.** Namespace `/gallery`: server emits `new` (a GalleryItem) and `hide` (`{ id }`). Namespace `/status`: client emits `subscribe(jobId)`, server emits `job` (a MintJob). Clients may also poll REST.
- **`GalleryItem` = the existing shared type + `id: string` (artwork/job id) + `status: 'pending' | 'minted' | 'approved' | 'hidden'`.** `tokenId` may be absent until minted.
- Route params are `:jobId`. Listing any status other than `approved` requires `Authorization: Bearer <ADMIN_TOKEN>`; `approved` is public.
- QR / verify URL format is frozen: `<VERIFY_URL>/#/token/{tokenId}`.
- If `docs/api.md` disagrees with this block, this block wins; Member 4 updates the docs (issue X0).

Other fixed facts every agent can rely on:

- Monorepo with npm workspaces: `contracts`, `backend`, `shared`, `web-kiosk`, `web-gallery`, `web-admin`, `web-verify`; `scripts/` and `docs/` at the root.
- Mint pipeline stages (in order): `hashing -> uploading -> minting -> confirmed`, or `failed`. Retries are visible in the job status.
- Image is PNG, at most 500 KB (`MAX_IMAGE_KB`), nickname 1-32 characters, no personal data collected.
- Moderation default `MODERATION_MODE=display_after_approve`: new mints are `minted` (pending moderation); only an admin action makes them `approved`. Only `approved` is public.
- Only the backend holds the minter key. The verify app reads the chain and IPFS directly and never calls the backend.
- Environment variable names in use: `API_URL`, `RPC_URL`, `CONTRACT_ADDRESS`, `ADMIN_TOKEN`, `MOCK_API`, `MODERATION_MODE`, `KILL_SWITCH`, `IPFS_PROVIDER`, `MAX_IMAGE_KB`, `RATE_LIMIT_PER_MIN`, `MINTER_PRIVATE_KEY`, `PINATA_JWT`, `KUBO_API`, and for apps `VITE_API_URL`, `VITE_IPFS_GATEWAY`, `VITE_IPFS_GATEWAYS`, `VITE_RPC_URL`, `VITE_CONTRACT_ADDRESS`, `VITE_CHAIN_ID`, `VITE_EXPLORER_URL`, `VITE_VERIFY_URL`.

## 3. Roles and task bundles

| Member | GitHub | Role | Tasks |
|---|---|---|---|
| 1 | @ambadi565 | Contracts, Scripts & Infra | C1, C3, E1, E2, D3, CI1 |
| 2 | @KnightFang36 | Backend Modules | B5, B2, B3, B6, B7 |
| 3 | @moulishvarmajv | Gallery, Shared utils & Booth | S3, G1, G2, D2 |
| 4 | @NiranjanRSoorej06 | Core pipeline, Kiosk & Integration | X0, S1, S2, B0, C2, B4, W1, K0, K1, K2, K3, K4, K5, I1, I2, Q1, D1, Q2 |
| 5 | @Robo-man | Verify + Admin apps | V1, V2, V3, A1, A2 |

- **CORE** tasks (Member 4) are the core pipeline, the whole kiosk, wiring and integration. They may depend on other tasks.
- **INDEPENDENT** tasks (Members 1, 2, 3, 5) have `Depends on: None`, own disjoint files, and are testable alone. They can all start at the same moment.

## 4. File ownership map

Each path belongs to one owner. Member 4's integration tasks (I1, I2) may fix bugs in any folder, but must first comment on the owner's issue. If a path is not listed here, nobody may edit it without a new issue.

| Path | Task(s) | Owner |
|---|---|---|
| `contracts/scripts/**` | C1 | @ambadi565 |
| `contracts/deployments/**` | C1 | @ambadi565 |
| `contracts/abi/**` | C1 | @ambadi565 |
| `docs/contract.md` | C1 | @ambadi565 |
| `.env.example` (chain/IPFS variable names only) | C1 | @ambadi565 |
| `contracts/test/**` | C3 | @ambadi565 |
| `docs/gas.md` | C3 | @ambadi565 |
| `scripts/e2e-mint.js` | E1 | @ambadi565 |
| `scripts/test/mock-api.mjs` | E1 | @ambadi565 |
| `scripts/seed-wall.js` | E2 | @ambadi565 |
| `scripts/export-data.js` | E2 | @ambadi565 |
| `scripts/test/seed-mock.mjs` | E2 | @ambadi565 |
| `infra/**` | D3 | @ambadi565 |
| `docker-compose.yml` | D3 | @ambadi565 |
| `.github/**` | CI1 | @ambadi565 |
| `backend/src/db/**` | B5 | @KnightFang36 |
| `backend/src/services/storage.ts` | B5 | @KnightFang36 |
| `backend/src/routes/gallery.ts` | B5 | @KnightFang36 |
| `backend/src/routes/admin.ts` | B5 | @KnightFang36 |
| `backend/src/routes/votes.ts` | B5 | @KnightFang36 |
| `backend/src/middleware/adminAuth.ts` | B5 | @KnightFang36 |
| `backend/src/middleware/validate.ts` | B2 | @KnightFang36 |
| `backend/src/utils/**` | B2 | @KnightFang36 |
| `backend/src/services/ipfs.ts` | B3 | @KnightFang36 |
| `backend/src/ws/**` | B6 | @KnightFang36 |
| `backend/src/middleware/rateLimit.ts` | B7 | @KnightFang36 |
| `backend/src/routes/health.ts` | B7 | @KnightFang36 |
| `shared/src/canvas/**` | S3 | @moulishvarmajv |
| `shared/src/nickname/**` | S3 | @moulishvarmajv |
| `web-gallery/**` | G1, G2 | @moulishvarmajv |
| `docs/booth-checklist.md` | D2 | @moulishvarmajv |
| `docs/demo-script.md` | D2 | @moulishvarmajv |
| `docs/booth/**` | D2 | @moulishvarmajv |
| `web-verify/**` | V1, V2, V3 | @Robo-man |
| `web-admin/**` | A1, A2 | @Robo-man |
| `docs/api.md` | X0, D1 | @NiranjanRSoorej06 |
| `shared/src/types/**` | X0 | @NiranjanRSoorej06 |
| `README.md and AGENT.md files (only to fix references to raw `/ws/...` paths)` | X0 | @NiranjanRSoorej06 |
| `shared/package.json` | S1 | @NiranjanRSoorej06 |
| `shared/tsconfig.json` | S1 | @NiranjanRSoorej06 |
| `shared/vitest.config.*` | S1 | @NiranjanRSoorej06 |
| `shared/src/index.*` | S1 | @NiranjanRSoorej06 |
| `shared/src/hashing/**` | S1 | @NiranjanRSoorej06 |
| `shared/src/qr/**` | S1 | @NiranjanRSoorej06 |
| `shared/src/api-client/**` | S2 | @NiranjanRSoorej06 |
| `backend/src/mock/**` | B0 | @NiranjanRSoorej06 |
| `backend/src/services/chain.ts` | C2 | @NiranjanRSoorej06 |
| `backend/src/services/queue.ts` | B4 | @NiranjanRSoorej06 |
| `backend/src/routes/status.ts` | B4 | @NiranjanRSoorej06 |
| `backend/src/index.ts` | W1 | @NiranjanRSoorej06 |
| `backend/src/config/**` | W1 | @NiranjanRSoorej06 |
| `backend/src/routes/artworks.ts` | W1 | @NiranjanRSoorej06 |
| `web-kiosk/package.json` | K0 | @NiranjanRSoorej06 |
| `web-kiosk/vite.config.*` | K0 | @NiranjanRSoorej06 |
| `web-kiosk/index.html` | K0 | @NiranjanRSoorej06 |
| `web-kiosk/src/main.*` | K0 | @NiranjanRSoorej06 |
| `web-kiosk/src/App.*` | K0 | @NiranjanRSoorej06 |
| `web-kiosk/src/lib/**` | K0 | @NiranjanRSoorej06 |
| `web-kiosk/src/pages/Attract*` | K0 | @NiranjanRSoorej06 |
| `web-kiosk/src/components/DrawingCanvas/**` | K1 | @NiranjanRSoorej06 |
| `web-kiosk/src/pages/Draw*` | K1 | @NiranjanRSoorej06 |
| `web-kiosk/src/pages/Nickname*` | K2 | @NiranjanRSoorej06 |
| `web-kiosk/src/hooks/**` | K3 | @NiranjanRSoorej06 |
| `web-kiosk/src/components/MintProgress/**` | K4 | @NiranjanRSoorej06 |
| `web-kiosk/src/pages/Progress*` | K4 | @NiranjanRSoorej06 |
| `web-kiosk/src/components/CertificateCard/**` | K5 | @NiranjanRSoorej06 |
| `web-kiosk/src/pages/Certificate*` | K5 | @NiranjanRSoorej06 |
| `Integration fixes in any folder (comment on the owner's issue first); `docs/integration-log.md`` | I1 | @NiranjanRSoorej06 |
| `.env files (local only)` | I2 | @NiranjanRSoorej06 |
| `docs/integration-log.md` | I2 | @NiranjanRSoorej06 |
| `scripts/load-test.mjs` | Q1 | @NiranjanRSoorej06 |
| `scripts/test/drills/**` | Q1 | @NiranjanRSoorej06 |
| `docs/architecture.md` | D1 | @NiranjanRSoorej06 |
| `README.md` | D1 | @NiranjanRSoorej06 |
| `docs/contract.md (only after C1 is merged, and only to fix mismatches)` | D1 | @NiranjanRSoorej06 |
| `Release checklist issue comments only; git tag `v0.1-expo`` | Q2 | @NiranjanRSoorej06 |

## 5. Task index

| ID | Title | Type | Owner | Phase | Pri | Depends on |
|---|---|---|---|---|---|---|
| C1 | contracts: fix deploy script, export ABI, deploy localhost + Polygon Amoy, set up wallets | INDEPENDENT | @ambadi565 | P1 Independent | P0 | None |
| C3 | contracts: round out tests and record gas per mint | INDEPENDENT | @ambadi565 | P1 Independent | P1 | None |
| E1 | scripts: implement e2e-mint.js (the current stub exits 0 = false pass) | INDEPENDENT | @ambadi565 | P1 Independent | P0 | None |
| E2 | scripts: seed-wall.js and export-data.js | INDEPENDENT | @ambadi565 | P1 Independent | P1 | None |
| D3 | infra: Dockerfile.backend, fix docker-compose, offline stack (Hardhat + Kubo) | INDEPENDENT | @ambadi565 | P1 Independent | P1 | None |
| CI1 | infra: GitHub Action - hardhat test + type-check on PRs | INDEPENDENT | @ambadi565 | P1 Independent | P2 | None |
| B5 | backend: storage layer + gallery / admin / votes routers (all in one module set) | INDEPENDENT | @KnightFang36 | P1 Independent | P0 | None |
| B2 | backend: upload validation module (pure functions + multer middleware) | INDEPENDENT | @KnightFang36 | P1 Independent | P0 | None |
| B3 | backend: IPFS service (Pinata primary, Kubo fallback) | INDEPENDENT | @KnightFang36 | P1 Independent | P0 | None |
| B6 | backend: realtime module (Socket.IO) for gallery + job status | INDEPENDENT | @KnightFang36 | P1 Independent | P0 | None |
| B7 | backend: rate-limit middleware + health router | INDEPENDENT | @KnightFang36 | P1 Independent | P1 | None |
| S3 | shared: canvas export + nickname modules (pure code with tests) | INDEPENDENT | @moulishvarmajv | P1 Independent | P0 | None |
| G1 | web-gallery: whole app - Wall, GalleryGrid, live updates (against its own mock) | INDEPENDENT | @moulishvarmajv | P1 Independent | P0 | None |
| G2 | web-gallery: NewArtToast (confetti), attract overlay, vote bars | INDEPENDENT | @moulishvarmajv | P1 Independent | P1 | None |
| D2 | docs/booth: booth checklist, demo script, role cards, poster text, fallback plan | INDEPENDENT | @moulishvarmajv | P1 Independent | P1 | None |
| V1 | web-verify: whole app - /#/token/{id}, trustless verification | INDEPENDENT | @Robo-man | P1 Independent | P0 | None |
| V2 | web-verify: TamperCanvas (flip pixels -> new hash -> side-by-side fail) | INDEPENDENT | @Robo-man | P1 Independent | P1 | None |
| V3 | web-verify: static-host config + deployment readiness | INDEPENDENT | @Robo-man | P1 Independent | P0 | None |
| A1 | web-admin: whole app - auth with auto-lock + moderation Queue | INDEPENDENT | @Robo-man | P1 Independent | P0 | None |
| A2 | web-admin: Dashboard (health, balance banner, kill switch, reset) | INDEPENDENT | @Robo-man | P1 Independent | P1 | None |
| X0 | Apply the frozen decisions to docs/api.md and shared types | CORE | @NiranjanRSoorej06 | P2 Core | P0 | None |
| S1 | shared: wire exports, tsconfig, vitest; merge hashing; integrate S3 modules | CORE | @NiranjanRSoorej06 | P2 Core | P0 | None (S3 wired in when it lands) |
| S2 | shared: typed api-client | CORE | @NiranjanRSoorej06 | P2 Core | P0 | S1, X0 |
| B0 | backend: MOCK_API mode (fixtures + fake realtime events) | CORE | @NiranjanRSoorej06 | P2 Core | P0 | X0 |
| C2 | backend: chain service (ethers v6 signer, mint, receipt parsing, balance, backfill) | CORE | @NiranjanRSoorej06 | P2 Core | P0 | None (uses the Hardhat artifact ABI) |
| B4 | backend: mint queue (stage machine, retry/backoff, idempotency) + status route | CORE | @NiranjanRSoorej06 | P2 Core | P0 | B2, B3, C2, B5 |
| W1 | backend: wire everything in index.ts (routers, middleware, realtime, queue, kill switch) | CORE | @NiranjanRSoorej06 | P2 Core | P0 | B2, B3, B5, B6, B7, B4 |
| K0 | web-kiosk: scaffold, config, screen state machine, Attract page, idle reset | CORE | @NiranjanRSoorej06 | P2 Core | P0 | S1 |
| K1 | web-kiosk: DrawingCanvas (tools + exact-bytes PNG export) | CORE | @NiranjanRSoorej06 | P2 Core | P0 | K0, S3 |
| K2 | web-kiosk: Nickname page | CORE | @NiranjanRSoorej06 | P2 Core | P1 | K0, S3 |
| K3 | web-kiosk: useMintJob hook (submit, WS + 1s polling fallback, retry, double-submit guard) | CORE | @NiranjanRSoorej06 | P2 Core | P0 | K0, S2, B0 |
| K4 | web-kiosk: MintProgress (4 stages with real hash / CID / tx values) | CORE | @NiranjanRSoorej06 | P2 Core | P1 | K3 |
| K5 | web-kiosk: CertificateCard (artwork, token id, date, QR, download) | CORE | @NiranjanRSoorej06 | P2 Core | P0 | K3, S1 |
| I1 | integration: kiosk -> backend -> gallery -> admin full loop on localhost | CORE | @NiranjanRSoorej06 | P3 Integration | P0 | All P1/P2 issues |
| I2 | integration: Polygon Amoy + Pinata, phone verify over cellular | CORE | @NiranjanRSoorej06 | P3 Integration | P0 | I1, C1, V3 |
| Q1 | backend: failure drills, load test (20-50 mints), secret-leak check | CORE | @NiranjanRSoorej06 | P3 Integration | P1 | I1 |
| D1 | docs: sync api.md / contract.md / architecture.md and the README quickstart | CORE | @NiranjanRSoorej06 | P3 Integration | P1 | I1 |
| Q2 | release: Definition-of-Done checklist, bug triage, code freeze, tag | CORE | @NiranjanRSoorej06 | P3 Integration | P0 | I2 |

Priority: **P0** must ship; **P1** should ship; **P2** cut first. Cut order if behind: votes/leaderboard, CI1, E2, A2 extras, K4 animation polish, D3, V2 (last). **Never cut:** hash recompute (B2), moderation hide (B5, A1), retry queue (B4), verify page (V1), e2e script (E1).

## 6. Task blocks

### Member 1 - @ambadi565 - Contracts, Scripts & Infra

#### C1 - contracts: fix deploy script, export ABI, deploy localhost + Polygon Amoy, set up wallets

- **Type:** INDEPENDENT  |  **Owner:** @ambadi565  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** Everyone eventually needs a contract address + ABI. The contract and 1 test file already exist; the deployment tooling is incomplete.
- **OWNS (may create/edit):**
  - `contracts/scripts/**`
  - `contracts/deployments/**`
  - `contracts/abi/**`
  - `docs/contract.md`
  - `.env.example` (chain/IPFS variable names only)
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Output files: `contracts/deployments/<network>.json` and `contracts/abi/GraffitiWall.json`. Nothing else in the repo is changed by you.
- **Do:**
  1. **Bug:** `deploy.ts` uses `provider.getNetwork().name`, which is `unknown` on Hardhat, so it writes `deployments/unknown.json`. Use `hre.network.name`.
  2. Write `deployments/<network>.json` = `{address, block, abi}` and also export the ABI to `contracts/abi/GraffitiWall.json` (single source of truth).
  3. Create the minter wallet and a spare; fund the deployer/minter from a Polygon Amoy faucet.
  4. Create a Pinata account + JWT. Hand secrets to Member 4 via a password manager only; never commit them. Add the chain/IPFS variables to `.env.example` (variable names only).
  5. Deploy to `localhost` and `polygon-amoy`; commit `deployments/polygon-amoy.json`; update `docs/contract.md` with the address and explorer link.
- **TEST ALONE (no other task needed):** `npx hardhat node` in one terminal, `npx hardhat run scripts/deploy.ts --network localhost` in another. Needs no other issue.
- **DONE when (all true):**
  - `npx hardhat test` green
  - `deployments/polygon-amoy.json` committed with address + block + abi after deployment
  - A JS snippet calling `verify()` on testnet round-trips
  - Tests for this task pass locally; PR opened per section 7.

#### C3 - contracts: round out tests and record gas per mint

- **Type:** INDEPENDENT  |  **Owner:** @ambadi565  |  **Priority:** P1  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** Root `AGENT.md` asks for 5+ test cases and a gas budget for ~200 mints.
- **OWNS (may create/edit):**
  - `contracts/test/**`
  - `docs/gas.md`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** No interface; the contract is not changed. If you think a contract change is needed, open an issue labelled `contract-change` instead of editing `GraffitiWall.sol`.
- **Do:**
  1. Tests: non-minter reverts, id increments, `verify` true/false, `ArtworkMinted` event emitted, `tokenURI` set, empty CID/hash/URI revert, nickname > 32 chars reverts.
  2. Record gas per mint and the estimated total for 200 mints in `docs/gas.md` (new file); include explorer-verify steps.
- **TEST ALONE (no other task needed):** `npx hardhat test` and `REPORT_GAS=true npx hardhat test`.
- **DONE when (all true):**
  - `npx hardhat test` shows 5+ new or confirmed cases
  - `docs/gas.md` has real gas numbers
  - Tests for this task pass locally; PR opened per section 7.

#### E1 - scripts: implement e2e-mint.js (the current stub exits 0 = false pass)

- **Type:** INDEPENDENT  |  **Owner:** @ambadi565  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** A fast regression check for the whole pipeline. Today the stub prints TODO and exits 0, which would hide breakage.
- **OWNS (may create/edit):**
  - `scripts/e2e-mint.js`
  - `scripts/test/mock-api.mjs`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Consumes only the documented REST API and the contract ABI (`contracts/artifacts` after `hardhat compile`).
- **Do:**
  1. CLI: `node scripts/e2e-mint.js <png> <nickname>`. Env: `API_URL`, `RPC_URL`, `CONTRACT_ADDRESS` (defaults from `.env.example`).
  2. Flow per `docs/api.md`: SHA-256 the PNG bytes, `POST /api/artworks` (multipart, `X-Device-Id`), poll `GET /api/artworks/:jobId/status` until `confirmed` or `failed`, then read the chain and call `verify(tokenId, hash)`.
  3. Print `{jobId, imageCID, tokenId, txHash, verified}`; exit non-zero on any failure or timeout.
  4. Immediately change the stub to `exit 1` so it can no longer false-pass.
- **TEST ALONE (no other task needed):** Write a tiny mock API in `scripts/test/mock-api.mjs` that returns a jobId and walks through statuses; run `hardhat node` and deploy locally. Member 4 runs it against the real backend later (I1).
- **DONE when (all true):**
  - Passes against your own mock API + a local Hardhat node
  - Non-zero exit on failed job, timeout, hash mismatch, and unreachable API
  - Tests for this task pass locally; PR opened per section 7.

#### E2 - scripts: seed-wall.js and export-data.js

- **Type:** INDEPENDENT  |  **Owner:** @ambadi565  |  **Priority:** P1  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** `package.json` references both but neither exists. The wall must never be empty at opening.
- **OWNS (may create/edit):**
  - `scripts/seed-wall.js`
  - `scripts/export-data.js`
  - `scripts/test/seed-mock.mjs`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Consumes the documented REST API only (`API_URL`, `ADMIN_TOKEN` env).
- **Do:**
  1. `seed-wall.js [n=10]`: generate n varied PNGs procedurally (e.g. `pngjs`, no external images), `POST /api/artworks` each, wait for confirmation, then approve via `POST /api/admin/artworks/:id/approve` with the admin token.
  2. `export-data.js`: read all statuses from `GET /api/gallery` (admin token) and write `exports/YYYY-MM-DD.json` and `.csv`.
- **TEST ALONE (no other task needed):** Write your own small inline mock server (do not depend on E1's mock).
- **DONE when (all true):**
  - Against a mock API both scripts complete and produce valid files
  - Clear error if the API is unreachable or the token is wrong
  - Tests for this task pass locally; PR opened per section 7.

#### D3 - infra: Dockerfile.backend, fix docker-compose, offline stack (Hardhat + Kubo)

- **Type:** INDEPENDENT  |  **Owner:** @ambadi565  |  **Priority:** P1  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** `docker-compose.yml` builds `./backend` but no Dockerfile exists (root `AGENT.md` expects `infra/docker/Dockerfile.backend`).
- **OWNS (may create/edit):**
  - `infra/**`
  - `docker-compose.yml`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Backend start command is whatever `backend/package.json` defines; you do not change backend code.
- **Do:**
  1. Add `infra/docker/Dockerfile.backend` (pinned base image, non-root, no secrets baked in) and point compose at it.
  2. Compose services: `hardhat` node, `kubo`, `backend`. Inside compose the backend uses `RPC_URL=http://hardhat:8545` and `KUBO_API=http://kubo:5001`.
  3. Add healthchecks and a documented one-liner to deploy the contract to the compose Hardhat node.
- **TEST ALONE (no other task needed):** The backend is a stub today; it only needs to boot. Verify connectivity with `curl` from inside the container.
- **DONE when (all true):**
  - `docker compose up --build` starts all three services
  - From the backend container the Hardhat and Kubo endpoints are reachable
  - No secret appears in the image or compose file
  - Tests for this task pass locally; PR opened per section 7.

#### CI1 - infra: GitHub Action - hardhat test + type-check on PRs

- **Type:** INDEPENDENT  |  **Owner:** @ambadi565  |  **Priority:** P2  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** A cheap safety net for 5 people merging into one repo.
- **OWNS (may create/edit):**
  - `.github/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** None.
- **Do:**
  1. `.github/workflows/ci.yml`: `npm ci`, `npx hardhat test`, and `tsc --noEmit` for every workspace that has a `tsconfig.json` (skip the rest so empty workspaces don't fail).
  2. Run on PRs to `main`; cache npm.
- **TEST ALONE (no other task needed):** Test with a throwaway PR in a fork or a branch.
- **DONE when (all true):**
  - Green check on a sample PR
  - A deliberate type error in a workspace turns it red
  - Tests for this task pass locally; PR opened per section 7.

### Member 2 - @KnightFang36 - Backend Modules

#### B5 - backend: storage layer + gallery / admin / votes routers (all in one module set)

- **Type:** INDEPENDENT  |  **Owner:** @KnightFang36  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** The data and moderation backbone: only `approved` is public; admin is the only writer of `approved` / `hidden`.
- **OWNS (may create/edit):**
  - `backend/src/db/**`
  - `backend/src/services/storage.ts`
  - `backend/src/routes/gallery.ts`
  - `backend/src/routes/admin.ts`
  - `backend/src/routes/votes.ts`
  - `backend/src/middleware/adminAuth.ts`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Exports: `createStorage`, `createGalleryRouter`, `createAdminRouter`, `createVotesRouter`, `adminAuth`. Member 4 mounts them in W1; you do not edit `backend/src/index.ts`.
- **Do:**
  1. `createStorage(dbPathOrDb)`: SQLite (better-sqlite3), runs `db/schema.sql`, seeds `config` defaults. Methods: `insertArtwork`, `getById`, `setMinted({id,tokenId,txHash,blockNumber,imageCID,metadataCID})`, `setStatus`, `list({status,limit,cursor})`, `getConfig/setConfig`, `addVote/leaderboard`, `archiveAll()`.
  2. `createGalleryRouter({storage, adminToken})`: `GET /api/gallery?status=&limit=&cursor=` (public only for `approved`).
  3. `createAdminRouter({storage, adminToken, hooks:{onApproved(item), onHidden(id)}})`: `POST /api/admin/artworks/:id/approve|hide`, `PUT /api/admin/config {MODERATION_MODE, KILL_SWITCH, IPFS_PROVIDER}`, `POST /api/admin/reset {confirm:'ARCHIVE YYYY-MM-DD'}` (archives, never silently deletes).
  4. `createVotesRouter({storage})`: `POST /api/votes {artworkId, category, voterKey}` (unique triple -> 409), `GET /api/leaderboard`.
  5. `middleware/adminAuth.ts`: 401 without a valid Bearer token.
  6. Hooks are injected callbacks so you never import the realtime module.
- **TEST ALONE (no other task needed):** vitest + supertest with an in-memory SQLite database; mount routers on a throwaway express app in the tests.
- **DONE when (all true):**
  - Non-approved items never appear in a public `?status=approved` query
  - Every admin route returns 401 without the token
  - Double vote returns 409; reset needs the exact typed confirmation
  - Tests cover storage and all routers
  - Tests for this task pass locally; PR opened per section 7.

#### B2 - backend: upload validation module (pure functions + multer middleware)

- **Type:** INDEPENDENT  |  **Owner:** @KnightFang36  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** The security gate of the pipeline: the bytes received must equal the bytes that were hashed.
- **OWNS (may create/edit):**
  - `backend/src/middleware/validate.ts`
  - `backend/src/utils/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Exports `validateUpload` and `createUploadMiddleware`. Rate limiting, kill switch, DB insert and queueing are NOT yours; Member 4 wires `POST /api/artworks` in W1.
- **Do:**
  1. `validateUpload({bytes, clientHash, nickname, maxKb}) -> {ok:true, sha256, nickname} | {ok:false, status, code, message}`: PNG magic bytes, size limit (413), nickname 1-32 chars + profanity (use the existing `backend/src/utils` nickname filter), **recompute SHA-256 with `node:crypto` and reject if it differs from `clientHash`** (400).
  2. `createUploadMiddleware({maxKb})`: multer memory storage, fields as in `docs/api.md`, attaches `req.upload = {bytes, sha256, nickname}` or responds with the error. No re-encoding anywhere.
- **TEST ALONE (no other task needed):** vitest for the pure function; supertest for the middleware on a throwaway express app.
- **DONE when (all true):**
  - Hash mismatch, oversize, non-PNG, empty/blocked nickname all rejected, each with a test
  - A valid PNG passes and returns the recomputed hash
  - Tests for this task pass locally; PR opened per section 7.

#### B3 - backend: IPFS service (Pinata primary, Kubo fallback)

- **Type:** INDEPENDENT  |  **Owner:** @KnightFang36  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** Pin the exact image bytes and the metadata JSON; return CIDs.
- **OWNS (may create/edit):**
  - `backend/src/services/ipfs.ts`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Exports `createIpfs`, `IpfsError`. Member 4's queue (B4) calls it.
- **Do:**
  1. `createIpfs({provider:'pinata'|'kubo', pinataJwt, kuboApi, gatewayUrl, fetchImpl?})` -> `{pinImage(bytes) -> imageCID, pinMetadata({name, description, image:'ipfs://<cid>', attributes:[Creator, SHA-256, Event]}) -> metadataCID}`.
  2. Automatic fallback to the other provider on failure; request timeouts; typed errors (`IpfsError` with `retryable` flag) so the queue can decide to retry.
  3. All config is passed in as arguments (do not read `process.env` inside the module).
- **TEST ALONE (no other task needed):** Inject `fetchImpl` in tests. For a live check, run Kubo locally (`ipfs daemon`) or use a free Pinata JWT.
- **DONE when (all true):**
  - Unit tests with an injected fetch cover success, timeout, 5xx and fallback
  - Optional live smoke script works with a real Pinata JWT
  - Tests for this task pass locally; PR opened per section 7.

#### B6 - backend: realtime module (Socket.IO) for gallery + job status

- **Type:** INDEPENDENT  |  **Owner:** @KnightFang36  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** Wall and kiosk update live.
- **OWNS (may create/edit):**
  - `backend/src/ws/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Exports `createRealtime`. B5's `onApproved/onHidden` hooks and the queue call these functions; Member 4 connects them in W1.
- **Do:**
  1. `createRealtime(httpServer, {allowedOrigin}) -> {emitNew(item), emitHide(id), emitJob(jobId, job), close()}` using the frozen namespaces (`/gallery`: `new`, `hide`; `/status`: `subscribe(jobId)` -> `job`).
  2. Clients join a per-job room so two kiosks never see each other's jobs. No per-socket state needed for backfill (clients backfill via REST).
- **TEST ALONE (no other task needed):** vitest with `socket.io-client` against a locally created HTTP server.
- **DONE when (all true):**
  - Two clients subscribed to different jobs get no crosstalk
  - `emitNew`/`emitHide` reach all `/gallery` clients
  - Tests for this task pass locally; PR opened per section 7.

#### B7 - backend: rate-limit middleware + health router

- **Type:** INDEPENDENT  |  **Owner:** @KnightFang36  |  **Priority:** P1  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** The admin dashboard and boot checklist depend on health; abuse protection needs a limiter.
- **OWNS (may create/edit):**
  - `backend/src/middleware/rateLimit.ts`
  - `backend/src/routes/health.ts`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Exports `createRateLimit`, `createHealthRouter`. Member 4 injects the real check functions in W1.
- **Do:**
  1. `createRateLimit({perMinute, keyFn})` express middleware returning 429 with `Retry-After`.
  2. `createHealthRouter({checks:{chain:()=>Promise<boolean>, ipfs:()=>Promise<boolean>, queueDepth:()=>number, balanceEth:()=>Promise<number>}})` -> `GET /api/health` = `{ok, chain, ipfs, queueDepth, balanceEth}`; a failing check reports false but never throws; no secrets in the response.
- **TEST ALONE (no other task needed):** supertest with fake check functions and fake timers.
- **DONE when (all true):**
  - Limiter returns 429 after the threshold and recovers after the window
  - Health reports each check independently with injected fakes
  - Tests for this task pass locally; PR opened per section 7.

### Member 3 - @moulishvarmajv - Gallery, Shared utils & Booth

#### S3 - shared: canvas export + nickname modules (pure code with tests)

- **Type:** INDEPENDENT  |  **Owner:** @moulishvarmajv  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** Small, self-contained utilities the kiosk and backend need.
- **OWNS (may create/edit):**
  - `shared/src/canvas/**`
  - `shared/src/nickname/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Do NOT edit `shared/package.json`, `shared/src/index`, or any other shared file; Member 4 wires the exports in S1.
- **Do:**
  1. `shared/src/canvas/index.ts`: `exportPNG(canvas, {maxBytes}) -> Promise<Blob>` (throws a typed error if over `maxBytes`), `blobToBytes(blob) -> Promise<Uint8Array>`. No re-encoding after hashing.
  2. `shared/src/nickname/index.ts`: `validateNickname(raw) -> {ok:true,value}|{ok:false,reason}` (trim, 1-32 chars) and `containsProfanity(s)`.
- **TEST ALONE (no other task needed):** vitest; mock `canvas.toBlob` in the test environment.
- **DONE when (all true):**
  - Unit tests for both modules
  - Neither module imports anything from `backend/` or `web-*`
  - Tests for this task pass locally; PR opened per section 7.

#### G1 - web-gallery: whole app - Wall, GalleryGrid, live updates (against its own mock)

- **Type:** INDEPENDENT  |  **Owner:** @moulishvarmajv  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** The crowd magnet on the big screen. You own the entire `web-gallery/` folder, including the scaffold.
- **OWNS (may create/edit):**
  - `web-gallery/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Consumes `GET /api/gallery?status=approved&limit&cursor` and Socket.IO `/gallery` (`new`, `hide`) exactly as in the frozen decisions.
- **Do:**
  1. Vite + React + TS + Tailwind scaffold (add the missing deps: `socket.io-client`, `framer-motion`).
  2. Fullscreen responsive grid for 1080p; images from `VITE_IPFS_GATEWAY/<cid>`, lazy-loaded.
  3. `useGallerySocket`: REST backfill (`GET /api/gallery?status=approved`) + Socket.IO `/gallery` `new` / `hide`, dedupe by `id`, REST poll every 10s as fallback, reconnect after a backend restart without duplicates.
  4. Env: `VITE_API_URL`, `VITE_IPFS_GATEWAY`. Keep a local `src/types.ts` mirroring the frozen `GalleryItem`; Member 4 swaps it for the shared type later.
- **TEST ALONE (no other task needed):** Write `web-gallery/mock/server.mjs` (express + socket.io) that serves fixtures and emits `new`/`hide` every few seconds; add `npm run mock`.
- **DONE when (all true):**
  - `hide` removes an item instantly with no flicker
  - Survives killing and restarting the mock server
  - 200+ generated items scroll/render smoothly
  - Tests for this task pass locally; PR opened per section 7.

#### G2 - web-gallery: NewArtToast (confetti), attract overlay, vote bars

- **Type:** INDEPENDENT  |  **Owner:** @moulishvarmajv  |  **Priority:** P1  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** Polish that sells the booth. Same folder and mock as G1.
- **OWNS (may create/edit):**
  - `web-gallery/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Consumes `GET /api/leaderboard` (optional).
- **Do:**
  1. Confetti + zoom-in on a `new` event; empty-state overlay 'Draw it. Mint it. Own it.' with a QR to the gallery/verify page.
  2. Vote bars from `GET /api/leaderboard` only when it responds (feature-detect, hide otherwise).
- **TEST ALONE (no other task needed):** Extend your G1 mock server.
- **DONE when (all true):**
  - Looks right at 1080p
  - Gracefully hidden when leaderboard is unavailable
  - Tests for this task pass locally; PR opened per section 7.

#### D2 - docs/booth: booth checklist, demo script, role cards, poster text, fallback plan

- **Type:** INDEPENDENT  |  **Owner:** @moulishvarmajv  |  **Priority:** P1  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** Event-day readiness, written from the existing docs; Member 4 adjusts details after integration.
- **OWNS (may create/edit):**
  - `docs/booth-checklist.md`
  - `docs/demo-script.md`
  - `docs/booth/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** None.
- **Do:**
  1. `docs/booth-checklist.md` and `docs/demo-script.md`: a timed ~90-second visitor demo, who greets/moderates/explains, one-page print-friendly role cards.
  2. Poster copy + QR-to-gallery sign text; the explainer line 'testnet = no real value'.
  3. A fallback plan (what to show if Wi-Fi/RPC/IPFS fails: pre-seeded wall, recorded demo video script).
- **TEST ALONE (no other task needed):** Based on the README, root `AGENT.md`, and `nft_graffiti_wall_plan.md`.
- **DONE when (all true):**
  - A teammate can run the booth from the printed pages alone
  - Tests for this task pass locally; PR opened per section 7.

### Member 5 - @Robo-man - Verify + Admin apps

#### V1 - web-verify: whole app - /#/token/{id}, trustless verification

- **Type:** INDEPENDENT  |  **Owner:** @Robo-man  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** The public proof page; it must NOT call the backend. You own the entire `web-verify/` folder, including the scaffold.
- **OWNS (may create/edit):**
  - `web-verify/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Reads only the chain and IPFS. The QR format `<VERIFY_URL>/#/token/{tokenId}` is frozen.
- **Do:**
  1. Vite + React + TS scaffold; hash route `/#/token/{id}`.
  2. Read `artworks(tokenId)` through a public RPC (ethers v6, read-only). Take the ABI from `contracts/artifacts` after `npx hardhat compile` and keep a copy in `web-verify/src/abi.ts`.
  3. Fetch the image from IPFS gateways (try 2, handle slowness/CORS), recompute SHA-256 in the browser with WebCrypto, compare to the on-chain hash.
  4. Badge: VERIFIED / FAILED with both hashes, CID, nickname, timestamp, explorer link. Handle token-not-found and a slow gateway with a staged loader.
  5. Env: `VITE_RPC_URL`, `VITE_CONTRACT_ADDRESS`, `VITE_CHAIN_ID`, `VITE_EXPLORER_URL`, `VITE_IPFS_GATEWAYS` (comma list).
- **TEST ALONE (no other task needed):** Write `web-verify/dev/mint-local.mjs`: compile + deploy the contract to a local Hardhat node, pin nothing, and mint one test token whose image CID points at a locally served test PNG. You do not need C1.
- **DONE when (all true):**
  - Works with every backend turned off
  - A token minted by your local helper shows VERIFIED; an unknown id shows not-found
  - Tests for this task pass locally; PR opened per section 7.

#### V2 - web-verify: TamperCanvas (flip pixels -> new hash -> side-by-side fail)

- **Type:** INDEPENDENT  |  **Owner:** @Robo-man  |  **Priority:** P1  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** The signature teaching moment.
- **OWNS (may create/edit):**
  - `web-verify/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** None beyond V1's data.
- **Do:**
  1. Load the original into a canvas; a 'Try to tamper' button flips pixels / draws a dot, re-exports, recomputes the hash, and shows original vs new hash with the line: 'The chain remembers the original fingerprint; any edited copy fails.'
- **TEST ALONE (no other task needed):** Use your local helper token from V1.
- **DONE when (all true):**
  - A tampered image shows a different hash and a clear FAILED state
  - Tests for this task pass locally; PR opened per section 7.

#### V3 - web-verify: static-host config + deployment readiness

- **Type:** INDEPENDENT  |  **Owner:** @Robo-man  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** QR codes must resolve from visitors' phones, not from the expo network.
- **OWNS (may create/edit):**
  - `web-verify/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** The final env values (RPC, contract address) are supplied later by Member 4 in I2.
- **Do:**
  1. SPA config for Vercel/Netlify (hash routing must work on refresh), env var table in `web-verify/README.md`, build verified with `npm run build` + `npm run preview`.
  2. Deploy to a free host and note the public URL in the README; document which gateway fallbacks and CORS behaviour you verified.
- **TEST ALONE (no other task needed):** Deploy with placeholder env values; the app must not crash when the chain is unreachable.
- **DONE when (all true):**
  - The deployed site loads, and an unknown token id shows the not-found state
  - Lighthouse mobile performance noted in the README
  - Tests for this task pass locally; PR opened per section 7.

#### A1 - web-admin: whole app - auth with auto-lock + moderation Queue

- **Type:** INDEPENDENT  |  **Owner:** @Robo-man  |  **Priority:** P0  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** Moderation is an MVP must-have. You own the entire `web-admin/` folder, including the scaffold.
- **OWNS (may create/edit):**
  - `web-admin/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Consumes the admin routes and the Bearer-token rule from the frozen decisions.
- **Do:**
  1. Vite + React + TS scaffold. `ADMIN_TOKEN` entered once, kept in memory only, auto-lock after 5 minutes of inactivity.
  2. `pages/Queue.tsx`: grid of `pending` / `minted` items (`GET /api/gallery?status=` with the Bearer token), big Approve / Hide buttons (`POST /api/admin/artworks/:id/approve|hide`), hide reachable in 2 clicks, nickname highlighted, restore hidden items.
  3. Env: `VITE_API_URL`, `VITE_IPFS_GATEWAY`. Local `src/types.ts` mirroring the frozen `GalleryItem`.
- **TEST ALONE (no other task needed):** Write `web-admin/mock/server.mjs` implementing those routes with fixtures; add `npm run mock`.
- **DONE when (all true):**
  - Wrong/missing token -> 401 handled with a clear message
  - Approve/hide update the UI immediately and survive a refresh
  - Tests for this task pass locally; PR opened per section 7.

#### A2 - web-admin: Dashboard (health, balance banner, kill switch, reset)

- **Type:** INDEPENDENT  |  **Owner:** @Robo-man  |  **Priority:** P1  |  **Phase:** P1 Independent
- **Depends on:** None
- **Purpose:** Ops control room. Same folder and mock as A1.
- **OWNS (may create/edit):**
  - `web-admin/**`
- **MUST NOT edit:** any path not listed above.
- **Interface / outputs:** Consumes `GET /api/health` and `PUT /api/admin/config`.
- **Do:**
  1. QueueHealth from `GET /api/health`: depth, chain/IPFS status; red banner if `balanceEth` < 0.01.
  2. `PUT /api/admin/config`: KILL_SWITCH toggle, `IPFS_PROVIDER` switch, `MODERATION_MODE`.
  3. Reset with a typed `ARCHIVE YYYY-MM-DD` confirmation.
- **TEST ALONE (no other task needed):** Extend your A1 mock server.
- **DONE when (all true):**
  - Reset only proceeds with the exact typed text
  - UI reflects each config change from the server response
  - Tests for this task pass locally; PR opened per section 7.

### Member 4 - @NiranjanRSoorej06 - Core pipeline, Kiosk & Integration

#### X0 - Apply the frozen decisions to docs/api.md and shared types

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** None
- **Purpose:** The interface decisions are already made (see below). This issue records them in the repo so docs and types match what the others are building against.
- **OWNS (may create/edit):**
  - `docs/api.md`
  - `shared/src/types/**`
  - `README.md and AGENT.md files (only to fix references to raw `/ws/...` paths)`
- **Do:**
  1. Update `docs/api.md`: Socket.IO namespaces/events, `:jobId`, admin Bearer rule, `GalleryItem` fields.
  2. Update `shared/src/types` (`GalleryItem.id/status`), README/AGENT references to raw `/ws/...` paths.
  3. Announce in the team chat that the docs now match; open a `contract-change` PR.
- **DONE when (all true):**
  - Docs and types match the frozen block exactly
  - Tests for this task pass locally; PR opened per section 7.

#### S1 - shared: wire exports, tsconfig, vitest; merge hashing; integrate S3 modules

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** None (S3 wired in when it lands)
- **Purpose:** Every app imports from `@graffiti/shared`, but `package.json` only exposes `types` today.
- **OWNS (may create/edit):**
  - `shared/package.json`
  - `shared/tsconfig.json`
  - `shared/vitest.config.*`
  - `shared/src/index.*`
  - `shared/src/hashing/**`
  - `shared/src/qr/**`
- **Do:**
  1. `exports` map for `hashing`, `types`, `qr`, `canvas`, `api-client`, `nickname`; `tsconfig.json`; vitest.
  2. Merge the duplicate `hashing/index.ts` + `browser.ts` into one `sha256Bytes` (WebCrypto with Node fallback).
  3. Re-export S3's `canvas` and `nickname` modules once merged; tests: `SHA256('abc') = ba7816bf...`, `buildVerifyUrl` / `parseTokenId`.
- **DONE when (all true):**
  - `npm test -w shared` is green
  - A frontend can import `sha256Bytes` from `@graffiti/shared/hashing`
  - Tests for this task pass locally; PR opened per section 7.

#### S2 - shared: typed api-client

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** S1, X0
- **Purpose:** One typed fetch wrapper for the kiosk (and later gallery/admin).
- **OWNS (may create/edit):**
  - `shared/src/api-client/**`
- **Do:**
  1. `submitArtwork(blob, nickname, clientHash, deviceId)`, `getStatus(jobId)`, `getGallery({status,limit,cursor})`, admin calls, `health`, `leaderboard`.
  2. Base URL injected, zod-validated responses, typed `ApiError` (400/429/503).
- **DONE when (all true):**
  - Unit tests with mocked fetch
  - Works against the B0 mock backend
  - Tests for this task pass locally; PR opened per section 7.

#### B0 - backend: MOCK_API mode (fixtures + fake realtime events)

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** X0
- **Purpose:** Lets the kiosk be built and demoed with no chain or IPFS.
- **OWNS (may create/edit):**
  - `backend/src/mock/**`
- **Do:**
  1. With `MOCK_API=true` serve all documented routes with fixtures; `POST /api/artworks` walks `hashing -> uploading -> minting -> confirmed` over ~8s on REST status and Socket.IO.
  2. Add cors; document `MOCK_API=true npm run dev -w backend`.
- **DONE when (all true):**
  - The kiosk flow runs with no chain or IPFS running
  - Tests for this task pass locally; PR opened per section 7.

#### C2 - backend: chain service (ethers v6 signer, mint, receipt parsing, balance, backfill)

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** None (uses the Hardhat artifact ABI)
- **Purpose:** The only module that touches the minter key.
- **OWNS (may create/edit):**
  - `backend/src/services/chain.ts`
- **Do:**
  1. `services/chain.ts`: `mint(nickname, imageCID, sha256Hex, metadataURI) -> {tokenId, txHash, blockNumber}` (parse `ArtworkMinted` from the receipt, wait 1 confirmation, nonce-safe), `getBalanceEth()`, `ping()`.
  2. Backfill DB rows missing a tokenId from `ArtworkMinted` events.
  3. The key is never logged or returned.
- **DONE when (all true):**
  - Mints on a local Hardhat node and on Polygon Amoy
  - Integration test against a Hardhat node
  - Tests for this task pass locally; PR opened per section 7.

#### B4 - backend: mint queue (stage machine, retry/backoff, idempotency) + status route

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** B2, B3, C2, B5
- **Purpose:** Visitors never wait on a flaky RPC or IPFS call. The core of reliability.
- **OWNS (may create/edit):**
  - `backend/src/services/queue.ts`
  - `backend/src/routes/status.ts`
- **Do:**
  1. `services/queue.ts` (p-queue, concurrency 1-2): `hashing -> uploading -> minting -> confirmed | failed`; 3 retries with exponential backoff and retry info in status; idempotent by `jobId`.
  2. On confirm: store `tokenId, txHash, blockNumber, CIDs` via B5 storage, set `minted` (or `approved` if moderation is off), call the realtime emitters.
  3. `GET /api/artworks/:jobId/status` returns a `MintJob`; expose queue depth.
- **DONE when (all true):**
  - PNG in -> confirmed with a tokenId on a local chain
  - IPFS made to fail once -> the job retries and succeeds with no data loss
  - Tests for this task pass locally; PR opened per section 7.

#### W1 - backend: wire everything in index.ts (routers, middleware, realtime, queue, kill switch)

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** B2, B3, B5, B6, B7, B4
- **Purpose:** Assemble the independently built modules into the real server.
- **OWNS (may create/edit):**
  - `backend/src/index.ts`
  - `backend/src/config/**`
  - `backend/src/routes/artworks.ts`
- **Do:**
  1. Mount B5 routers, B7 rate limit + health (inject real chain/IPFS/queue/balance checks), B6 realtime (connect `onApproved/onHidden` and queue events).
  2. `POST /api/artworks`: rate limit -> kill switch (503 on POST only) -> B2 upload middleware -> insert pending -> enqueue -> `202 {jobId}`.
  3. `config/env.ts` (zod-validated, root `.env`), CORS, graceful shutdown.
- **DONE when (all true):**
  - The server boots with only the required env set and `/api/health` reports real status
  - Kill switch blocks only POST artworks
  - Tests for this task pass locally; PR opened per section 7.

#### K0 - web-kiosk: scaffold, config, screen state machine, Attract page, idle reset

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** S1
- **Purpose:** The kiosk has only an `AGENT.md` + `package.json` today.
- **OWNS (may create/edit):**
  - `web-kiosk/package.json`
  - `web-kiosk/vite.config.*`
  - `web-kiosk/index.html`
  - `web-kiosk/src/main.*`
  - `web-kiosk/src/App.*`
  - `web-kiosk/src/lib/**`
  - `web-kiosk/src/pages/Attract*`
- **Do:**
  1. Vite + React + TS + Tailwind + router; `lib/config.ts` reads `VITE_*`; add the missing deps (framer-motion, qrcode.react, socket.io-client).
  2. Flow: Attract -> Draw -> Nickname -> Progress -> Certificate; idle timeout resets to Attract and cancels sockets/timers.
- **DONE when (all true):**
  - Flow navigable with stub screens
  - Idle reset works from any screen
  - Tests for this task pass locally; PR opened per section 7.

#### K1 - web-kiosk: DrawingCanvas (tools + exact-bytes PNG export)

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** K0, S3
- **Purpose:** The heart of the UX, and where hash-mismatch bugs are born.
- **OWNS (may create/edit):**
  - `web-kiosk/src/components/DrawingCanvas/**`
  - `web-kiosk/src/pages/Draw*`
- **Do:**
  1. Brush, eraser, colour, size, undo/redo, clear, optional timer; mouse + touch; buttons >= 48px (works on a laptop trackpad).
  2. Export through `shared/canvas`; keep <= 500KB; **hash the exact Blob bytes that are uploaded**.
- **DONE when (all true):**
  - Touch and mouse both work
  - Exported bytes hash identically to what `submitArtwork` sends
  - Tests for this task pass locally; PR opened per section 7.

#### K2 - web-kiosk: Nickname page

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P1  |  **Phase:** P2 Core
- **Depends on:** K0, S3
- **Purpose:** Single field, no personal data.
- **OWNS (may create/edit):**
  - `web-kiosk/src/pages/Nickname*`
- **Do:**
  1. 1-32 chars via `shared/nickname`; inline errors; disable on submit.
- **DONE when (all true):**
  - Blocked words are rejected client-side and the backend still returns 400 if bypassed
  - Tests for this task pass locally; PR opened per section 7.

#### K3 - web-kiosk: useMintJob hook (submit, WS + 1s polling fallback, retry, double-submit guard)

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** K0, S2, B0
- **Purpose:** Single source of truth for mint progress.
- **OWNS (may create/edit):**
  - `web-kiosk/src/hooks/**`
- **Do:**
  1. POST via api-client with a persisted `X-Device-Id`; subscribe to `/status` and also poll every 1s; expose `{stage, retryInfo, tokenId, txHash, imageCID, hash, error, retry}`.
  2. Double-tap submit creates exactly one job; friendly messages for 400/429/503.
- **DONE when (all true):**
  - Works against the mock backend, then the real one
  - A WebSocket drop mid-job is completed by polling
  - Tests for this task pass locally; PR opened per section 7.

#### K4 - web-kiosk: MintProgress (4 stages with real hash / CID / tx values)

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P1  |  **Phase:** P2 Core
- **Depends on:** K3
- **Purpose:** Teaches the pipeline while the visitor waits.
- **OWNS (may create/edit):**
  - `web-kiosk/src/components/MintProgress/**`
  - `web-kiosk/src/pages/Progress*`
- **Do:**
  1. Hashing -> Uploading -> Minting -> Confirmed with Framer Motion, real SHA-256, CIDs and tx hash, retry state, and a failure screen with a retry button.
- **DONE when (all true):**
  - Looks right fullscreen on a laptop display
  - Error state verified with a forced failed job
  - Tests for this task pass locally; PR opened per section 7.

#### K5 - web-kiosk: CertificateCard (artwork, token id, date, QR, download)

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P2 Core
- **Depends on:** K3, S1
- **Purpose:** The take-home.
- **OWNS (may create/edit):**
  - `web-kiosk/src/components/CertificateCard/**`
  - `web-kiosk/src/pages/Certificate*`
- **Do:**
  1. Card with artwork, tokenId, date, nickname and a QR from `shared/qr.buildVerifyUrl(VITE_VERIFY_URL, tokenId)`; download as PNG; print-friendly CSS.
- **DONE when (all true):**
  - QR scans from a phone to the verify URL
  - The downloaded image is readable
  - Tests for this task pass locally; PR opened per section 7.

#### I1 - integration: kiosk -> backend -> gallery -> admin full loop on localhost

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P3 Integration
- **Depends on:** All P1/P2 issues
- **Purpose:** The first real end-to-end run on one machine (Hardhat + Kubo).
- **OWNS (may create/edit):**
  - `Integration fixes in any folder (comment on the owner's issue first); `docs/integration-log.md``
- **Do:**
  1. Run Hardhat + real backend + kiosk + gallery + admin. Draw -> mint -> pending in admin -> approve -> on the wall -> hide removes it.
  2. Run E1's e2e script. Swap the local `types.ts` copies in gallery/admin for the shared type. File every bug as an issue labelled `integration` for the owner.
- **DONE when (all true):**
  - Draw to certificate works
  - Kiosk hash == backend sha256 == on-chain `artworkHash`
  - Tests for this task pass locally; PR opened per section 7.

#### I2 - integration: Polygon Amoy + Pinata, phone verify over cellular

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P3 Integration
- **Depends on:** I1, C1, V3
- **Purpose:** Prove it on the real network.
- **OWNS (may create/edit):**
  - `.env files (local only)`
  - `docs/integration-log.md`
- **Do:**
  1. Switch `.env` to testnet; run E1, then the full UI loop. Set the deployed verify site's env (RPC, contract address) and `VITE_VERIFY_URL` in the kiosk.
  2. From a phone on cellular: QR -> VERIFIED, and try the tamper page.
- **DONE when (all true):**
  - `verify()` is true for a token visible on the explorer
  - QR -> VERIFIED on a phone over cellular
  - Tests for this task pass locally; PR opened per section 7.

#### Q1 - backend: failure drills, load test (20-50 mints), secret-leak check

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P1  |  **Phase:** P3 Integration
- **Depends on:** I1
- **Purpose:** Booth reliability.
- **OWNS (may create/edit):**
  - `scripts/load-test.mjs`
  - `scripts/test/drills/**`
- **Do:**
  1. Fire 20-50 mints; confirm no jobs are lost and rate limits behave.
  2. Drills: IPFS down, RPC down, minter out of gas, kill switch. Record behaviour in `docs/booth-checklist.md` (coordinate with D2's author).
  3. Grep logs and responses for `MINTER_PRIVATE_KEY` / `PINATA_JWT`.
- **DONE when (all true):**
  - No lost jobs and clear kiosk error states
  - No secret in logs or responses
  - Tests for this task pass locally; PR opened per section 7.

#### D1 - docs: sync api.md / contract.md / architecture.md and the README quickstart

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P1  |  **Phase:** P3 Integration
- **Depends on:** I1
- **Purpose:** Docs must match what was built.
- **OWNS (may create/edit):**
  - `docs/api.md`
  - `docs/architecture.md`
  - `README.md`
  - `docs/contract.md (only after C1 is merged, and only to fix mismatches)`
- **Do:**
  1. Update all docs for the final routes; fill in the architecture trust boundaries; verify README quickstart commands on a fresh clone.
- **DONE when (all true):**
  - Someone outside the team can follow the README to a working local mint
  - Tests for this task pass locally; PR opened per section 7.

#### Q2 - release: Definition-of-Done checklist, bug triage, code freeze, tag

- **Type:** CORE  |  **Owner:** @NiranjanRSoorej06  |  **Priority:** P0  |  **Phase:** P3 Integration
- **Depends on:** I2
- **Purpose:** End with a working demo, not half-merged branches.
- **OWNS (may create/edit):**
  - `Release checklist issue comments only; git tag `v0.1-expo``
- **Do:**
  1. Keep the root `AGENT.md` section 6 checklist as a tick list here; triage `integration` bugs; call a code freeze before the final rehearsal; tag `v0.1-expo` from a green `main`.
- **DONE when (all true):**
  - Every DoD box ticked or consciously cut
  - Tag pushed
  - Tests for this task pass locally; PR opened per section 7.

## 7. Execution protocol (every task)

1. Read root `AGENT.md`, this file (sections 1-2 and your task block), and your folder's `AGENT.md`.
2. `git checkout -b feat/<folder>-<short-name>` from the latest `main`.
3. Implement strictly inside `OWNS`. Add dependencies with `npm install -w <workspace> <pkg>`.
4. Build the stub/mock named under `TEST ALONE` first, then the real module against it.
5. Run the workspace tests and type-check (`npm test -w <workspace>`, `npx tsc --noEmit -p <workspace>`). Fix until green.
6. Rebase on `main`, rerun tests, open a PR titled `[<ID>] <title>` whose body contains: `Closes #<issue>`, a checklist copy of **DONE when**, any **Assumptions**, and how you tested.
7. Label the PR `contract-change` if (and only if) you changed a REST/WS/Solidity/type/QR interface, and update the matching doc in the same PR.
8. Comment on the issue with a 3-line summary: what was built, what Member 4 must wire (exact exported names), what you could not verify.

## 8. Integration contracts (what Member 4 wires in W1)

Member 4 consumes these exports. Independent tasks MUST export exactly these names.

| Module | Exports | Consumed by |
|---|---|---|
| B5 `services/storage.ts`, `routes/{gallery,admin,votes}.ts`, `middleware/adminAuth.ts` | `createStorage`, `createGalleryRouter`, `createAdminRouter`, `createVotesRouter`, `adminAuth` | W1 mounts routers under `/api`; B4 uses `storage` |
| B2 `middleware/validate.ts` | `validateUpload`, `createUploadMiddleware` | W1 `POST /api/artworks` |
| B3 `services/ipfs.ts` | `createIpfs`, `IpfsError` | B4 |
| B6 `ws/*` | `createRealtime` -> `{emitNew, emitHide, emitJob, close}` | W1 constructs; B4 calls `emitJob`; B5 admin hooks call `emitNew/emitHide` |
| B7 `middleware/rateLimit.ts`, `routes/health.ts` | `createRateLimit`, `createHealthRouter` | W1 |
| C2 `services/chain.ts` | `mint`, `getBalanceEth`, `ping`, backfill | B4, W1 (health checks) |
| S3 `shared/src/{canvas,nickname}` | `exportPNG`, `blobToBytes`, `validateNickname`, `containsProfanity` | S1 re-exports; K1, K2 |
| C1 `contracts/deployments/*`, `contracts/abi/*` | `<network>.json` `{address, block, abi}`, `GraffitiWall.json` ABI | C2, I2, V3 env values |
| G1/A1/V1 apps | standalone Vite apps with `npm run dev`, `npm run mock` (G1, A1), `npm run build` | I1/I2 (Member 4 swaps local `types.ts` for the shared type) |

Kiosk flow (Member 4): `Attract -> Draw -> Nickname -> Progress -> Certificate`; idle timeout returns to Attract and cancels sockets and timers.

## 9. When blocked or unsure

- **Independent task, something you need is missing:** use the stub named in `TEST ALONE`. Never block on another task.
- **CORE task, a dependency is not merged yet:** work against the documented interface with a local fake, or move to the next task in Member 4's order (`X0, S1, B0, C2, S2, K0, K3, K1, K2, K5, K4, B4, W1, I1, I2, Q1, D1, Q2`). Add the `blocked` label only if nothing else is workable.
- **A frozen decision seems wrong, or two docs conflict:** stop, comment on the issue with the evidence and one proposed fix; do not implement your own variant.
- **You need a change in a file you do not own:** comment on Member 4's issue (or the owner's issue) describing the exact change; do not edit it yourself.
- **Finished early:** review a teammate's PR (pairs: Member 1 and 2, Member 3 and 5; Member 4 reviews every `contract-change`), or ask Member 4 for another task.

## 10. Definition of done for the whole project

The project is done when the root `AGENT.md` section 6 checklist is satisfied: draw -> certificate works on the kiosk; the kiosk hash equals the backend `sha256` equals the on-chain `artworkHash`; hide removes an item from the wall; the verify page shows VERIFIED from a phone on cellular and FAILED for a tampered copy; killing the backend does not break the verify page; no secret appears in logs or responses; `main` is green and tagged `v0.1-expo` (task Q2).
