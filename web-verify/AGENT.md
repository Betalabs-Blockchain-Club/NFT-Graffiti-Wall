# AGENT.md — `web-verify/` (Public Verification)

## 1. Purpose / Function
Trustless public proof page opened from visitor phones via QR. Recomputes hash in-browser and compares to on-chain value — **does not trust backend**. Also hosts the tamper demo that teaches immutability.

## 2. Inputs
- URL `/#/token/{tokenId}` (QR target from kiosk).
- Chain read: `artworks(tokenId)` + `verify(id, hash)` via public RPC (`VITE_RPC_URL`, `VITE_CONTRACT_ADDRESS`).
- IPFS: image bytes via public gateway (`VITE_IPFS_GATEWAY/<imageCID>`).
- Env (static, deploy to Vercel/Netlify/GitHub Pages): `VITE_RPC_URL, VITE_CONTRACT_ADDRESS, VITE_IPFS_GATEWAY`.

## 3. Outputs
- `✅ VERIFIED` or `❌ FAILED` badge + details: on-chain hash, recomputed hash, CID, nickname, timestamp, tx/explorer link.
- Tamper lab: canvas with "Try to tamper" → pixel flip → new hash → side-by-side compare → ❌.
- Teaching line: "The chain remembers the original fingerprint; any edited copy fails the check."

## 4. Functions / Responsibilities
1. `pages/VerifyToken.tsx` — parse tokenId, fetch on-chain struct, fetch image, `crypto.subtle.digest`, compare.
2. `components/VerifyBadge.tsx` — status + hashes + explorer link.
3. `components/TamperCanvas.tsx` — load image, mutate pixels, re-export exact bytes, recompute.
4. Must handle: token not found, gateway slow (show staged loader), CORS (try 2 gateways).
5. Static-only: no backend calls, no secrets, works from any phone browser.

## 5. Interfaces
- Reads contract ABI (copy from `contracts/artifacts`) + `shared/hashing` (same impl as kiosk).
- QR URL contract: `/#/token/{id}` — changing it breaks printed certificates.

## 6. Dependencies
- React + Vite + TS, ethers v6 (read-only), Tailwind. Deployed statically.

## 7. File layout
```text
web-verify/
├── AGENT.md
├── src/pages/VerifyToken.tsx
├── src/components/VerifyBadge.tsx
├── src/components/TamperCanvas.tsx
└── src/lib/verify.ts
```

## 8. Definition of Done
- [ ] Phone on cellular (not expo Wi-Fi) → QR → ✅ in <10s.
- [ ] Tampered image → ❌ with visibly different hash.
- [ ] Works with backend offline (chain + gateway only).

## 9. Non-goals
- No minting, no gallery, no backend dependency.

## 10. Member guide
1. `npm run dev`, set `VITE_CONTRACT_ADDRESS` to testnet deploy.
2. Test with real tokenId from `scripts/e2e-mint.js`, then test tamper button.
3. Deploy preview URL must be reachable by phones before event.
