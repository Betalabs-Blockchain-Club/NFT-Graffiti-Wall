# Expo Booth Contingency & Fallback Plan

> **Objective:** Ensure the NFT Graffiti Wall booth never goes dark, freezes, or fails in front of visitors—even under total venue Wi-Fi failure, RPC throttling, or IPFS gateway downtime.

---

## 1. Failure Matrix & Emergency Playbook

| Severity | Failure Mode | Trigger / Symptom | Emergency Action |
|----------|--------------|-------------------|------------------|
| **P0** | **Venue Wi-Fi Down** | Kiosk cannot connect to cloud backend; TV disconnects | Switch all booth hardware to dedicated **Cellular Hotspot (5G)**. If cellular also fails, trigger **Local Offline Mode** (Section 2). |
| **P1** | **RPC Node Throttling / Chain Congestion** | Minting step hangs on "Minting" >45s | Switch RPC endpoint in Admin Dashboard or run local Hardhat node (`npm run node`). Give visitor their temporary Job ID QR. |
| **P1** | **IPFS Gateway Timeout / CORS Error** | Image previews fail to load on mobile phones | Frontend switches to secondary IPFS gateways (Cloudflare / dweb.link) or local gateway cache. |
| **P2** | **Kiosk Tablet Crash / Hardware Freeze** | Touchscreen unresponsive or browser frozen | Reboot kiosk tablet; activate backup laptop running `web-kiosk` in under 60 seconds. |
| **P3** | **Total Power / Hardware Blackout** | Display TV loses power | Play the **Offline Video Demo Loop** (Section 4) on an iPad/laptop for queued visitors. |

---

## 2. Local Offline Mode (Zero Internet Fallback)

If the venue loses all external internet connectivity, the system can run entirely within a closed local booth network using Docker or local processes.

### Architecture
```
[ Kiosk Tablet ] ──(Local LAN/Hotspot)──> [ Booth Host Laptop ]
                                           ├── Hardhat Node (Port 8545)
                                           ├── Local IPFS / Kubo (Port 8080/5001)
                                           ├── Backend Server (Port 3000)
                                           └── Gallery & Verify Web Apps
```

### Steps to Activate Local Offline Mode
1. **Connect to Booth Local Router:**
   Connect Kiosk tablet, Display TV laptop, and Admin laptop to the booth's offline Wi-Fi router (SSID: `GraffitiBooth_Local`, Password: on router base).
2. **Launch Local Services:**
   On the host booth laptop, run:
   ```bash
   # From root repository
   docker compose up -d
   # Or run local Hardhat node + backend mock:
   npm run mock -w web-gallery
   ```
3. **Point Kiosk and Gallery to Local IP:**
   Set browser URL to `http://192.168.1.100:5173` (kiosk) and `http://192.168.1.100:5174` (gallery).
4. **Deploy Contract Locally:**
   ```bash
   npm run deploy:local -w contracts
   ```

---

## 3. Pre-Seeded Wall Setup

In the event of an early-morning startup before any visitors arrive, or to recover instantly after a database reset, use the pre-seeded artwork database so the big screen wall is never completely empty.

### How to Seed the Wall
1. Run the seed script:
   ```bash
   node scripts/seed-wall.js
   ```
2. Or in mock mode (`web-gallery/mock/server.mjs`), 12 high-contrast neon artworks with varied token IDs and vote counts are automatically pre-populated.
3. Verify on TV:
   - Total tags counter shows `12 Tags`.
   - Grid renders smoothly with colorful tags from diverse fictional artists (`CyberVandal`, `PixelRebel`, `NeonGhost`, etc.).
   - Vote bars show active community rankings.

---

## 4. Recorded Demo Video Fallback Script

If interactive minting cannot continue due to power or severe hardware failure, play the pre-rendered 90-second demo video on loop.

### Video Scene-by-Scene Storyboard & Audio Script

#### Scene 1: Introduction (0:00 - 0:15)
- **Visual:** High-energy cut of hands using the digital stylus on the kiosk tablet, drawing vibrant glowing graffiti tags ("CYBER 2026").
- **Voiceover:**
  > *"Welcome to the NFT Graffiti Wall. Anyone can step up, pick a brush, and leave their mark on a collaborative live digital canvas in under 60 seconds."*

#### Scene 2: Cryptographic Hashing (0:15 - 0:30)
- **Visual:** Close-up on the tablet screen. Visitor taps "Mint Art". The screen highlights raw PNG pixel array being converted into a 64-character SHA-256 hash.
- **Voiceover:**
  > *"Before any file leaves the tablet, the raw image pixels are cryptographically hashed using SHA-256. This creates an unforgeable 64-character fingerprint. Change one single pixel, and the entire code changes."*

#### Scene 3: Content-Addressed Storage (0:30 - 0:45)
- **Visual:** Animation showing IPFS decentralized node network. The file is assigned a Content Identifier (`bafybeicid...`).
- **Voiceover:**
  > *"The artwork is pinned to the InterPlanetary File System (IPFS). Unlike regular web links that can suffer from 404 errors or altered files, IPFS uses content addressing: the link itself is derived from the file's content."*

#### Scene 4: Smart Contract Minting (0:45 - 1:05)
- **Visual:** Screen captures the smart contract transaction on Ethereum testnet. Block confirmed! Token #42 minted to the artist.
- **Voiceover:**
  > *"Next, our automated backend executes an ERC-721 smart contract transaction on the Ethereum testnet, binding the author's nickname, IPFS CID, and cryptographic fingerprint immutably on-chain."*

#### Scene 5: Live Broadcast & Mobile Certificate (1:05 - 1:20)
- **Visual:** Dual screen cut. On the right, the visitor's smartphone scans the certificate QR code. On the left, the giant exhibition TV wall bursts with confetti as the new artwork takes its place.
- **Voiceover:**
  > *"The visitor scans their certificate QR code, opening a trustless mobile proof page. At the same instant, the live exhibition TV wall erupts with confetti, broadcasting their tag to the entire venue."*

#### Scene 6: The Tamper-Proof Challenge & Closer (1:20 - 1:30)
- **Visual:** On the mobile phone screen, the user taps "Try to Tamper". A single red pixel is inserted. The badge flips to a red warning: **VERIFICATION FAILED: HASH MISMATCH**.
- **Voiceover:**
  > *"Even if someone modifies a single pixel, the verification fails instantly. Creation, proof, storage, record, verification. That is the power of decentralized technology."*

---

## 5. Emergency Contacts & Quick Reference Sheet

Tape this table to the inside of the booth supply box:

| Contact / Role | Name | Phone / Discord |
|----------------|------|-----------------|
| **Team Lead** | Niranjan R Soorej | +91-XXXXXXXXXX / @NiranjanRSoorej06 |
| **Booth Operations** | Moulish Varma | +91-XXXXXXXXXX / @moulishvarmajv |
| **Backend & Chain** | Contracts / Backend Lead | Discord: #booth-emergency |
| **Expo Power & Facility** | TechFest Operations Desk | Booth Zone A / Radio Ch 4 |

### Essential Links
- **Testnet Explorer:** `https://sepolia.etherscan.io/address/<CONTRACT_ADDRESS>`
- **Testnet Faucet:** `https://sepoliafaucet.com`
- **IPFS Pinata Status:** `https://status.pinata.cloud`
- **Cloudflare Gateway:** `https://cloudflare-ipfs.com/ipfs/`
