# Contract Notes

- Contract: `contracts/contracts/GraffitiWall.sol` — ERC721 ("Blockchain Graffiti Wall", "GRAFFITI").
- Deploys: record in `contracts/deployments/<network>.json`.
- Networks: `base-sepolia` (default) | `sepolia` | `localhost`.
- After deploy: set `CONTRACT_ADDRESS` (backend) + `VITE_CONTRACT_ADDRESS` (all web-*).
- Gas: note per-mint cost here after first testnet mint (budget ~200 mints, pre-fund days early).
- Explorer verify: `npx hardhat verify --network base-sepolia <address>`.
