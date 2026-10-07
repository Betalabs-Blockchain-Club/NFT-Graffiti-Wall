# Contract Notes

- Contract: `contracts/contracts/GraffitiWall.sol` — ERC721 ("Blockchain Graffiti Wall", "GRAFFITI").
- Deploys: record in `contracts/deployments/<network>.json` = `{address, block, abi}`. The ABI there is read straight off the compiled artifact (`hre.artifacts.readArtifact`), so it's always in sync with the `.sol` — never hand-edit it.
- Single-source-of-truth ABI also exported to `contracts/abi/GraffitiWall.json` for consumers (backend `services/chain.ts`, frontends) that just want the ABI without the rest of the deployment record.
- Networks: `base-sepolia` (default) | `sepolia` | `localhost`.
- After deploy: set `CONTRACT_ADDRESS` (backend) + `VITE_CONTRACT_ADDRESS` (all web-*).

## Scripts (`contracts/scripts/`)

- `deploy.ts` — deploys `GraffitiWall`, writes `deployments/<network>.json` and `abi/GraffitiWall.json`. Previously used `provider.getNetwork().name`, which Hardhat reports as `"unknown"` for any network it doesn't recognize by chain ID — every deploy landed in `deployments/unknown.json`. Fixed to use `network.name` (the name passed via `--network`).
- `create-wallets.ts` — generates a minter wallet + a spare, offline, and prints both private keys once. Run it, copy the keys into a password manager immediately, then put `MINTER_PRIVATE_KEY` in the local `.env` (never commit it). Deploying with the minter key as the deployer account auto-grants it `MINTER_ROLE` (see the constructor).
- `verify-roundtrip.ts` — mints one artwork on `--network <name>` using that network's `deployments/<name>.json`, then calls `verify()` with the correct hash (expect `true`) and a tampered hash (expect `false`). Proves the deployment record is usable by a plain `ethers` client, independent of this Hardhat project.

## Local (localhost) — done, verified

```
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/verify-roundtrip.ts --network localhost
```

Round-trip passes. Gas for `mint()` on a fresh token: **~249,304 gas** (measured on localhost Hardhat EVM — re-measure once minted on an actual testnet, gas can differ slightly by EVM config). Budget ~200 mints at the event; pre-fund the minter wallet days early.

## base-sepolia — blocked, not deployed

Deploying to `base-sepolia` and committing `deployments/base-sepolia.json` needs a **funded** minter wallet, which needs two things only a human can do:

1. Run `npx hardhat run scripts/create-wallets.ts` to generate a minter + spare keypair, then fund both from a Base Sepolia faucet (e.g. https://www.alchemy.com/faucets/base-sepolia) — faucets rate-limit, so do this first.
2. Create a Pinata account and JWT (`PINATA_JWT`) — needed by the backend, not by this deploy step, but gather it at the same time since it's also a manual sign-up.

Once `MINTER_PRIVATE_KEY` in `.env` is funded:

```
npx hardhat run scripts/deploy.ts --network base-sepolia
npx hardhat run scripts/verify-roundtrip.ts --network base-sepolia
npx hardhat verify --network base-sepolia <address>
```

Then update this file with the real address + explorer link, and commit `deployments/base-sepolia.json`.

**Explorer verify:** `npx hardhat verify --network base-sepolia <address>`
