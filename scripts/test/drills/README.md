# Q1 Local Failure Drills

Use a local Hardhat + Kubo stack and the temporary local account only. Do not point these drills at Polygon Amoy or production credentials. Start the backend in another terminal and ensure `IPFS_PROVIDER=kubo`, `RPC_URL=http://127.0.0.1:8545`, and `KUBO_API=http://127.0.0.1:5001`.

## Load and rate limit

Run `node scripts/load-test.mjs 20` (or a count through 50). It submits unique-device jobs in parallel, checks every response for a unique job ID, polls each job to `confirmed`, then checks that repeated malformed uploads from one device receive `429` plus `Retry-After` at the configured threshold.

## Kill switch

Precondition: the local kill switch is off. Run `node scripts/test/drills/kill-switch.mjs`. It enables the switch, verifies a valid artwork POST gets `503` while health/gallery reads remain available, and restores the switch to off in `finally`.

## IPFS unavailable

With the backend still running, stop Kubo, submit one drill job, wait for its terminal failure, and restart Kubo:

```sh
docker compose stop kubo
node scripts/test/drills/submit-and-wait.mjs failed ipfs-down
docker compose start kubo
```

Expected result: the API accepted the job, the queue retried the unavailable provider, and the kiosk status reached `failed` with an error; after Kubo restarts, health reports IPFS available.

## RPC unavailable

Stop Hardhat, submit one drill job, then restart Hardhat and redeploy the contract because the local chain state resets:

```sh
docker compose stop hardhat
node scripts/test/drills/submit-and-wait.mjs failed rpc-down
docker compose start hardhat
```

Expected result: IPFS upload completes, mint retries fail, and the kiosk status reaches `failed`. Redeploy before any further mint tests and update `CONTRACT_ADDRESS` if the address differs.

## Minter out of gas

Set the local signer balance to zero, submit one job, then restore the development balance:

```sh
node scripts/test/drills/set-hardhat-balance.mjs 0
node scripts/test/drills/submit-and-wait.mjs failed no-gas
node scripts/test/drills/set-hardhat-balance.mjs 10000000000000000000000
```

Expected result: IPFS pinning succeeds, the chain transaction fails and retries, and the kiosk status reaches `failed`; the last command restores 10,000 local ETH.

## Secret scan

Capture backend output in a local log file, then scan it and selected response bodies:

```sh
node scripts/test/drills/check-secrets.mjs --log-file /tmp/q1-backend.log \
  --probe-url http://localhost:3001/api/health \
  --probe-url http://localhost:3001/api/gallery
```

The scanner reads root `.env` values when present, checks both secret names and configured values, and reports finding names/locations only; it never prints secrets or response bodies.
