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

## Local (localhost) — verified

```
npx hardhat node
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/verify-roundtrip.ts --network localhost
```

The local `verify-roundtrip.ts` check mints one token and confirms a correct hash returns `true` while a tampered hash returns `false`. The tracked `deployments/localhost.json` address is for the default Hardhat node only; the node resets on restart, so deploy again before using it. Gas for `mint()` on a fresh token: **~249,304 gas** (measured on localhost Hardhat EVM; re-measure on a testnet because EVM configuration can change gas use).

## base-sepolia — not yet deployed

This checkout has no `deployments/base-sepolia.json` and no testnet contract address. A Base Sepolia deployment needs a funded deployer/minter wallet. The backend also needs an IPFS provider credential if using Pinata; that credential is not needed to deploy the contract.

1. Run `npx hardhat run scripts/create-wallets.ts` to generate a minter + spare keypair, then fund the deployer/minter from a Base Sepolia faucet (for example, Alchemy's Base Sepolia faucet). Keep the spare key offline.
2. Configure the network RPC and funded `MINTER_PRIVATE_KEY` in the local `.env`.

Once `MINTER_PRIVATE_KEY` in `.env` is funded:

```
npx hardhat run scripts/deploy.ts --network base-sepolia
npx hardhat run scripts/verify-roundtrip.ts --network base-sepolia
npx hardhat verify --network base-sepolia <address>
```

After a successful deploy and round-trip, record the real address, block, ABI, and explorer link here; commit `deployments/base-sepolia.json`.

**Explorer verify:** `npx hardhat verify --network base-sepolia <address>`
