# AGENT.md — `contracts/` (On-Chain Proof)

## 1. Purpose / Function
Own the **sole source of on-chain truth**: the ERC-721 that stores the fingerprint proving "this art existed at this time by this nickname". No other folder may define mint/verify semantics. If the contract lies, verification is meaningless.

## 2. Inputs
- `mint(to: address, nickname: string ≤32, ipfsCID: string, artworkHash: bytes32, metadataURI: string)` — called **only** by backend minter wallet (`MINTER_ROLE`).
- `verify(tokenId: uint256, candidateHash: bytes32)` — called by anyone (verify page).
- `transferFrom` — standard claim-to-visitor flow (stretch).
- Env: `RPC_URL`, `MINTER_PRIVATE_KEY` (deploy only), `CHAIN_NETWORK`.

## 3. Outputs
- ERC-721 token with `tokenURI = ipfs://<metadataCID>`.
- `artworks[tokenId] = {creator, nickname, ipfsCID, artworkHash, timestamp}`.
- `ArtworkMinted(tokenId, creator, nickname, ipfsCID, artworkHash)` event.
- Deploy artifact: `deployments/<network>.json {address, abi, block}` consumed by backend (`CONTRACT_ADDRESS`) and frontends (`VITE_CONTRACT_ADDRESS`).

## 4. Functions / Responsibilities
1. Implement `GraffitiWall.sol` (OZ ERC721URIStorage + AccessControl, `MINTER_ROLE`, auto-increment `nextId`).
2. Enforce: only-minter mint, non-empty CID/hash/URI, nickname length guard.
3. Provide `verify()` view + `supportsInterface` override.
4. Tests: role gating (non-minter reverts), id increment, verify true/false, event emission, tokenURI set.
5. Deploy scripts for `localhost` + testnet (Base Sepolia default), verify on explorer, export address.
6. Publish ABI to `shared/src/types` consumers (copy or npm link, never hand-edit in two places).

## 5. Interfaces
- Solidity: see `contracts/GraffitiWall.sol` sketch in plan §5.2 (this repo's file is authoritative).
- JS: `scripts/deploy.ts` outputs `{ address }`. Backend `services/chain.ts` imports ABI from `artifacts/`.
- Must-not-change without `contract-change` PR: function signatures, event fields, struct order.

## 6. Dependencies
- OpenZeppelin contracts, Hardhat, ethers v6, TypeChain.
- Upstream: none (independent). Downstream: backend (mint), verify page (read), gallery (event).

## 7. File layout
```text
contracts/
├── AGENT.md
├── contracts/GraffitiWall.sol
├── test/GraffitiWall.test.ts
├── scripts/deploy.ts
├── hardhat.config.ts
└── package.json
```

## 8. Definition of Done
- [ ] `npx hardhat test` green (5+ cases above).
- [ ] Deploy to localhost + one testnet, `verify()` round-trips from JS.
- [ ] `deployments/base-sepolia.json` committed with address + block.
- [ ] Gas per mint noted in `docs/contract.md` (budget ~200 mints).

## 9. Non-goals
- No voting on-chain in MVP. No royalties, no enumerable, no visitor-key minting.
- No metadata hosting here — backend pins JSON, contract only stores URI string.

## 10. Member guide
1. `npm install && npx hardhat test`.
2. Edit only `contracts/GraffitiWall.sol` + tests. Never edit artifacts by hand.
3. After any `.sol` change: re-run tests, redeploy to localhost, notify backend owner to update `CONTRACT_ADDRESS`.
