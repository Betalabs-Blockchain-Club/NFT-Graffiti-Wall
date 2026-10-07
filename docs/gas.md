# Gas Report — GraffitiWall `mint()`

Measured with `REPORT_GAS=true npx hardhat test` against the Hardhat EVM
(solc 0.8.24, optimizer **disabled**, block limit 60 000 000 gas).

## Per-call figures

| Metric | Gas |
|--------|----:|
| Minimum (first mint, cold storage) | 249 208 |
| Maximum (warm storage path) | 266 392 |
| Average across 6 calls in the test suite | 263 492 |

## 200-mint event budget

| Estimate | Gas | Notes |
|----------|----:|-------|
| Conservative (avg × 200) | 52 698 400 | Use this for pre-funding |
| Worst-case (max × 200) | 53 278 400 | Upper bound |

At Base Sepolia / Base Mainnet gas prices the ETH cost is negligible at
current prices, but pre-fund the minter wallet with at least **0.05 ETH**
to cover all 200 mints plus deployment and a safety margin.

## Deployment cost

| Contract | Gas |
|----------|----:|
| GraffitiWall (deploy) | 2 987 586 |

## Notes

- Gas will be slightly lower once the optimizer is enabled for a production
  deploy (`settings.optimizer.enabled = true, runs: 200` in
  `hardhat.config.ts`). Re-measure before the live event.
- On Hardhat's in-process EVM, the first `_safeMint` call hits cold SLOAD/SSTORE
  slots (249 208 gas); subsequent mints to the same address pay warm-slot prices
  (≈ 266 392). In production every call comes from a different NFT recipient so
  expect figures closer to the minimum.

## Explorer-verify steps (Base Sepolia)

After `npx hardhat run scripts/deploy.ts --network base-sepolia` use the
Hardhat `verify` plugin to publish source:

```bash
npx hardhat verify --network base-sepolia <DEPLOYED_ADDRESS>
```

No constructor arguments are needed (the constructor takes none).

On success the plugin prints a Basescan URL like:
`https://sepolia.basescan.org/address/<DEPLOYED_ADDRESS>#code`

Open it and confirm the **Contract** tab shows a green ✓ and the
**Read Contract** / **Write Contract** sub-tabs are populated.  If
verification fails with "Already verified", the contract was already
submitted — that is fine.

After verifying, update `docs/contract.md` with the live address and
explorer link, and commit `contracts/deployments/base-sepolia.json`.
