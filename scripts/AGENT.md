# AGENT.md — `scripts/` (Ops Automation)

## 1. Purpose
One-command expo ops: smoke-test pipeline, seed wall, export data.

## 2. Inputs / Outputs
- `e2e-mint.js <png> <nickname>` — Input: PNG + nickname. Output: `{jobId, imageCID, tokenId, txHash, verified: true|false}`. Fails non-zero on ❌.
- `seed-wall.js [n=10]` — mints n pre-made arts so wall isn't empty at opening.
- `export-data.js` — dumps `artworks + votes` to `exports/YYYY-MM-DD.json/.csv`.
- All read root `.env`, never hardcode keys.

## 3. Done
- [ ] `node scripts/e2e-mint.js ./test.png Bot` passes on testnet + localhost fallback.
