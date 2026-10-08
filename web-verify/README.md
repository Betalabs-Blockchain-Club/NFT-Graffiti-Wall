# Graffiti Wall verification app

This static React app verifies `/#/token/{tokenId}` using only a public EVM RPC and IPFS gateways. It does not call the backend or ask visitors to connect a wallet. It reads `artworks(tokenId)`, downloads the image bytes, recomputes SHA-256 in the browser, and calls the contract's `verify(tokenId, hash)` view.

## Configuration

Set these public build-time variables in the hosting provider or `web-verify/.env.local`. Do not put private keys, Pinata JWTs, or admin tokens in this app.

| Variable | Required | Purpose |
|---|---:|---|
| `VITE_RPC_URL` | yes | Read-only RPC endpoint for the contract's network. |
| `VITE_CONTRACT_ADDRESS` | yes | Deployed GraffitiWall address on that network. |
| `VITE_CHAIN_ID` | recommended | Expected decimal chain ID; verification fails if RPC points to another network. |
| `VITE_EXPLORER_URL` | no | Explorer origin, for example `https://sepolia.basescan.org`. |
| `VITE_IPFS_GATEWAYS` | yes | Comma-separated gateway base URLs, each ending in `/ipfs`, in preferred order. The app tries the next gateway on HTTP, timeout, or browser CORS failure. |
| `VITE_IPFS_GATEWAY` | legacy | Single gateway fallback when `VITE_IPFS_GATEWAYS` is unset. |

These values are included in the public browser bundle. Only use public URLs and addresses here.

## Local contract-backed check

Install workspaces from the repository root with `npm install`. Start a fresh local Hardhat node in one terminal:

```sh
cd contracts
npx hardhat node --config ../web-verify/dev/hardhat.local.config.cjs
```

In a second terminal from the repository root, compile the real contract, deploy it to that node, mint token `1` with a local test PNG, and serve that PNG at the local gateway URL:

```sh
node web-verify/dev/mint-local.mjs
```

Keep the helper running. Copy the emitted `VITE_CONTRACT_ADDRESS` into the next command, then start Vite from `web-verify/`:

```sh
cd web-verify
VITE_RPC_URL=http://127.0.0.1:8545 VITE_CONTRACT_ADDRESS=0x... VITE_CHAIN_ID=31337 VITE_IPFS_GATEWAYS=http://127.0.0.1:4177/ipfs npm run dev
```

Open `http://localhost:5173/#/token/1`; it should show `VERIFIED`. `http://localhost:5173/#/token/999` should show `NOT FOUND`. No backend or live IPFS service is required. This local fixture is for development only and its CID is not a public IPFS CID.

Build the static app with `npm run build -w @graffiti/web-verify`. The token path is in the URL fragment, so it stays on the root document and works with static SPA hosting.
