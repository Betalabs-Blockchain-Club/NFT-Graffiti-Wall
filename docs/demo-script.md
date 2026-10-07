# 90-Second Timed Booth Demo Script

> **Purpose:** A tightly timed, high-energy walkthrough that guides an expo visitor from a blank drawing canvas to an immutable on-chain NFT certificate on their smartphone, followed by an interactive tamper-proof demonstration.

---

## Script Overview

| Phase | Duration | Focus Area | Visual / Physical Cue |
|-------|----------|------------|----------------------|
| **1. Hook & Draw** | 0:00 – 0:20 (20s) | Drawing on kiosk tablet | Hand stylus to visitor, start drawing timer |
| **2. Hash Fingerprint** | 0:20 – 0:30 (10s) | SHA-256 integrity | Point to 64-char hex string calculation |
| **3. Decentralized IPFS** | 0:30 – 0:40 (10s) | Content addressing | Point to Content Identifier (`bafy...`) |
| **4. On-Chain Mint** | 0:40 – 0:55 (15s) | ERC-721 transaction | Watch live transaction hash & block confirmation |
| **5. Claim Certificate** | 0:55 – 1:05 (10s) | Mobile verification QR | Visitor scans QR code with smartphone |
| **6. The Live Wall** | 1:05 – 1:15 (10s) | Broadcast TV display | Confetti burst & artwork spotlight on big screen |
| **7. Tamper Proof Demo** | 1:15 – 1:30 (15s) | Cryptographic security | Flip one pixel → hash changes → verification fails |

---

## Step-by-Step Spoken Script

### 1. Hook & Draw (0:00 – 0:20)
- **Action:** Greet visitor warmly, hand them the tablet stylus.
- **Spoken:**  
  > *"Welcome to the NFT Graffiti Wall! You’ve got 60 seconds — pick your brush, spray your tag, or draw whatever you like right here on the tablet."*
- **Action:** While visitor draws, prompt them for their handle:
- **Spoken:**  
  > *"Type in your nickname. In less than two minutes, this drawing will become a permanent piece of decentralized history."*

### 2. SHA-256 Fingerprint (0:20 – 0:30)
- **Action:** Visitor presses **"Mint My Art"**. The kiosk calculates the hash.
- **Spoken:**  
  > *"Right now in your browser, before anything touches the internet, we calculate a SHA-256 hash of your exact raw image pixels. This 64-character fingerprint uniquely identifies your artwork. If anyone changes even a single sub-pixel, this entire hash completely changes."*

### 3. Decentralized IPFS Storage (0:30 – 0:40)
- **Action:** Progress bar moves to **"Uploading"**.
- **Spoken:**  
  > *"Next, the image is pinned to IPFS — the InterPlanetary File System. Instead of a traditional URL pointing to an arbitrary server, IPFS uses content addressing. The CID address itself is derived directly from the file content."*

### 4. On-Chain Minting (0:40 – 0:55)
- **Action:** Progress bar moves to **"Minting"** → **"Confirmed"**.
- **Spoken:**  
  > *"Now our backend mints an ERC-721 NFT to the blockchain testnet. Notice the transaction hash and block number! Note: this is on an Ethereum testnet, meaning there is zero financial cost or speculation — this is a pure demonstration of transparent cryptographic ownership."*

### 5. Mobile Certificate QR (0:55 – 1:05)
- **Action:** The certificate QR appears on the kiosk screen.
- **Spoken:**  
  > *"Pull out your phone and scan this QR code! You don’t need an app or crypto wallet. It opens our trustless verification page directly on your phone's browser."*

### 6. The Big Screen Live Wall (1:05 – 1:15)
- **Action:** Point visitor toward the 1080p TV / projector display.
- **Spoken:**  
  > *"Look up at the big screen! Boom — there’s your confetti drop! Your graffiti tag just lit up the live collaborative wall for everyone at the expo to see."*

### 7. Interactive Tamper Demonstration (1:15 – 1:30)
- **Action:** On the visitor's phone (or explainer demo tablet), tap **"Try to Tamper"**.
- **Spoken:**  
  > *"Here is the key blockchain lesson: tap 'Try to Tamper'. It adds a tiny rogue dot to your image and recomputes the SHA-256 hash. Look — the new hash doesn't match the on-chain fingerprint, and the badge turns bright red: **VERIFICATION FAILED**.*  
  > *Web servers can be hacked, databases can be altered, but the blockchain never forgets the original fingerprint."*

---

## The Closer (Summary Line)

> *"Creation → Proof → Storage → Record → Verification.*  
> *That’s how Web3 guarantees digital authenticity without trusting a central authority. Thanks for tagging our wall!"*

---

## Quick Handling for Common Visitor Questions

- **Q: "Does this cost real money or crypto?"**  
  *A: "Not a penny! It’s deployed on a testnet. Gas fees are sponsored by our club kiosk. It’s completely free and educational."*
- **Q: "Can anyone delete my tag from the blockchain?"**  
  *A: "The big screen gallery can hide visual tags for moderation, but the on-chain mint and IPFS fingerprint remain forever immutable."*
- **Q: "Can I save my drawing?"**  
  *A: "Yes! The verification link on your phone lets you download your original high-res PNG and certificate anytime."*
