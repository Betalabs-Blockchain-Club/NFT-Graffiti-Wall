# Booth Readiness & Operational Checklist (Print-Friendly)

> **TechFest Expo / Event Operations Guide**  
> *Keep a printed copy at the booth reception desk. Any teammate should be able to operate the booth from this sheet alone.*

---

## 1. Morning Boot Sequence (T-30 to T-0 min)

### Hardware & Power (T-30 min)
- [ ] **Power & Cables:** Connect power strips; plug in TV wall display, kiosk tablet/laptop, booth laptop, and Wi-Fi hotspot backup.
- [ ] **Display Setup:** Set big TV/projector to 1920x1080 resolution; connect HDMI from display laptop running `web-gallery`.
- [ ] **Kiosk Tablet:** Turn on drawing tablet / touch laptop running `web-kiosk`; verify stylus calibration and touch sensitivity.
- [ ] **Cellular Hotspot:** Turn on dedicated backup phone hotspot; confirm SSID and password taped to back of booth laptop.

### Service & Network Health (T-20 min)
- [ ] **Backend Health:** Open browser to `http://<BACKEND_HOST>:3001/api/health` — confirm `ok: true`, `chain: true`, `ipfs: true`, and a numeric `queueDepth` and `balanceEth`.
- [ ] **Minter Gas Balance:** Open Admin Dashboard (`web-admin`). Verify minter account balance > **0.05 test-ETH**.
  - *If low:* Request faucet funds immediately or transfer from reserve admin wallet.
- [ ] **IPFS Pinning Access:** Perform test pin in Admin panel or verify Pinata JWT quota has >500 pins remaining.
- [ ] **Gallery Wall:** Open `web-gallery` in fullscreen (F11). Verify green **LIVE SOCKET** indicator and seed artworks render correctly.

### Dry-Run Test Mint (T-10 min)
- [ ] **End-to-End Mint Test:**
  1. Step up to kiosk: draw a simple star/smiley and set nickname `TestPilot`.
  2. Click Mint: verify progress bar moves: `Hashing` → `Uploading` → `Minting` → `Confirmed`.
  3. Verify QR code appears on kiosk screen.
  4. Scan QR code using a phone disconnected from expo Wi-Fi (**Cellular 4G/5G data**).
  5. Confirm `web-verify` displays **VERIFIED** badge, matching SHA-256 fingerprint and on-chain tokenId.
  6. Confirm new artwork pops up on the big TV wall with confetti animation (`NewArtToast`).
  7. In Admin panel, click **Hide** on the test item — confirm it disappears from the TV wall in <2 seconds.
  8. Restore or approve test item as needed.

---

## 2. Team Roles & Booth Shift Rotations

| Role | Primary Responsibility | Key Tools |
|------|------------------------|-----------|
| **Greeter** | Crowd magnet, queue manager, 30s onboarding, enforces 60s drawing timer | Queue line sign, stylus sanitizing wipes |
| **Explainer** | Guides visitor through hashing, IPFS, blockchain proof, runs tamper demo | Tablet/phone running `web-verify`, demo script |
| **Moderator** | Real-time monitoring of kiosk submissions, fast hides, system health | Laptop running `web-admin` Queue tab, kill switch |

> *Rotate roles every 60–90 minutes to keep team energy fresh.*  
> *Detailed single-page role sheets are in [`docs/booth/role-cards.md`](./booth/role-cards.md).*

---

## 3. Real-Time Shift Checklist (Hourly)

- [ ] Check minter wallet gas balance (`> 0.02 test-ETH`).
- [ ] Check kiosk tablet screen hygiene (clean stylus/screen with wipe).
- [ ] Verify `web-gallery` WebSocket connection is green and responsive.
- [ ] Review pending/hidden items in `web-admin` Queue tab.
- [ ] Confirm visitor QR verification page continues resolving quickly on cellular phones.

---

## 4. Failure Drills & Emergency Protocols

| Scenario | Symptom | Immediate Action |
|----------|---------|------------------|
| **Wi-Fi Drops** | Kiosk cannot reach backend | 1. Switch kiosk & server to mobile hotspot.<br>2. Keep the kiosk page open. If no Job ID was returned, submit again after reconnecting; drawings are not durably queued offline. If a Job ID exists, let status polling resume before retrying. |
| **RPC Outage / Minter Has No Gas** | Minting retries, then status becomes `failed` | 1. Restore the local RPC or fund the minter.<br>2. Keep the failed Job ID for the incident log.<br>3. Resume new submissions only after `/api/health` reports the chain healthy and the minter has gas. |
| **IPFS Pinning Outage** | Uploading retries, then status becomes `failed` | 1. Restore Pinata/Kubo.<br>2. Confirm `/api/health` reports IPFS healthy.<br>3. Keep the failed Job ID and ask the visitor before submitting a new job. |
| **Inappropriate / Offensive Art** | Obscene tag submitted | 1. Moderator clicks **Hide** in `web-admin` (<2 clicks, vanishes from TV instantly).<br>2. Calmly reassure visitors: *“Our live moderation filter caught and removed that tag.”* |
| **Total Outage (No Internet)** | Expo power / network blackout | 1. Activate **Offline Fallback Plan** ([`docs/booth/fallback-plan.md`](./booth/fallback-plan.md)).<br>2. Run local mock gallery + video loop. |

### Q1 Local Reliability Drill Results (2026-10-08)

- **20-mint load:** 20/20 jobs reached `confirmed`; no jobs were lost. The same-device probe received 400 for five malformed uploads, then 429 with `Retry-After: 60`.
- **IPFS stopped:** the accepted job retried through attempt 3 and reached `failed`.
- **RPC stopped:** the accepted job retried through attempt 3 and reached `failed`; Hardhat was restarted and the local contract redeployed afterward.
- **Minter balance set to zero:** the accepted job retried through attempt 3 and reached `failed`; the local balance was restored to 10,000 ETH.
- **Kill switch enabled:** valid artwork POST returned 503 while health and gallery GET remained available. The switch was restored to off.
- **Secret scan:** no `MINTER_PRIVATE_KEY` or `PINATA_JWT` name/value appeared in the captured backend log or probed health, gallery, and failed-job responses.

---

## 5. Evening Teardown & Archival (Post-Expo)

- [ ] **Data Export:** Run `node scripts/export-data.js` to dump all minted artwork records, hashes, and token IDs to `backend/data/archive-<date>.json`.
- [ ] **Backup Database:** Copy `backend/data/graffiti.db` to backup USB drive.
- [ ] **Leaderboard Screenshot:** Take high-res screenshot of top-voted artworks on TV wall for club social media.
- [ ] **Device Power Down:** Safely shut down all laptops and tablets; put styluses in charging cases; pack power strips.
- [ ] **Signage:** Collect posters, stands, and printed role cards for next event day.

---

## Related Booth Documentation
- [`docs/demo-script.md`](./demo-script.md) — Timed 90-second demo script with spoken prompts.
- [`docs/booth/role-cards.md`](./booth/role-cards.md) — 1-page print-ready role cards (Greeter, Moderator, Explainer).
- [`docs/booth/poster-and-signs.md`](./booth/poster-and-signs.md) — Banner copy, sign text & testnet disclaimers.
- [`docs/booth/fallback-plan.md`](./booth/fallback-plan.md) — Detailed offline contingency & video demo script.
