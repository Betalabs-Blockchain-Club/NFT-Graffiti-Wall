# Print-Friendly Booth Role Cards

> **Instructions:** Print these three cards on heavy letter-size cardstock. Cut along the dashed line or fold into tri-fold desk tents for team members on duty.

---

```
================================================================================
                           ROLE CARD 1: THE GREETER
================================================================================
MISSION:
Act as the energy hub of the booth. Attract expo foot traffic, manage the kiosk
drawing queue, and guide visitors into the 60-second drawing experience.

PRIMARY CHECKLIST:
[ ] Keep queue moving smoothly (max 2 people waiting at the kiosk).
[ ] Hand stylus to visitor with a friendly invitation.
[ ] Enforce the 60-second drawing time limit politely.
[ ] Ensure visitor enters an appropriate nickname (1–32 characters).
[ ] Wipe tablet screen and stylus with sanitizing wipe between visitors.

KEY ELEVATOR PITCH (30 SECONDS):
"Hey there! Want to tag our live NFT Graffiti Wall? Pick up the stylus, draw
whatever you like in 60 seconds, and watch our blockchain kiosk turn your
art into an immutable on-chain collectible in real time!"

HANDOFF CUE:
As soon as the visitor hits "Mint Art", hand them off to THE EXPLAINER:
"Awesome tag, [Nickname]! Our Explainer will show you how your art is being
hashed and minted on-chain right now."

DO'S & DON'TS:
+ DO keep energy high and smile.
+ DO encourage fun, expressive drawings.
- DON'T let visitors get stuck drawing complex art for 5+ minutes.
- DON'T discuss deep technical crypto jargon unless the visitor asks first.
================================================================================
```

---

```
================================================================================
                         ROLE CARD 2: THE EXPLAINER
================================================================================
MISSION:
Deliver the educational value of the demo. Walk the visitor through SHA-256
hashing, IPFS decentralized storage, on-chain minting, and the tamper-proof demo.

PRIMARY CHECKLIST:
[ ] Guide visitor through the 4-stage mint progress bar on kiosk screen.
[ ] Ensure visitor scans the QR certificate with their smartphone camera.
[ ] Point to the big 1080p TV wall when confetti explodes (`NewArtToast`).
[ ] Run the "Try to Tamper" test on the verify screen to demonstrate hash failure.
[ ] Emphasize: "Testnet = Pure tech demo with no real financial value."

KEY TEACHING POINTS:
1. "The SHA-256 hash is calculated in the browser. It's the unique digital fingerprint."
2. "IPFS stores the art using Content Identifiers (CID) instead of vulnerable URLs."
3. "The Ethereum testnet records the token ID, author nickname, and hash forever."
4. "The tamper demo proves that modifying even one pixel invalidates the proof."

FAQ ONE-LINERS:
* "Is this real crypto?" -> "It's on an Ethereum testnet! Pure technology, zero money."
* "Do I need a MetaMask wallet?" -> "No wallet needed! The certificate is trustlessly
  verifiable directly in any mobile browser."

DO'S & DON'TS:
+ DO invite them to tap "Try to Tamper" with their own finger.
+ DO celebrate when their artwork appears on the big screen.
- DON'T let them leave without scanning their phone QR certificate!
================================================================================
```

---

```
================================================================================
                         ROLE CARD 3: THE MODERATOR
================================================================================
MISSION:
Guard booth safety, ensure high content quality on the public TV display, and
monitor technical backend health and gas balances.

PRIMARY CHECKLIST:
[ ] Keep `web-admin` Queue tab active on laptop at all times.
[ ] Review every incoming artwork submission within 5 seconds.
[ ] If inappropriate content appears, click "Hide" immediately (<2 clicks).
[ ] Monitor minter wallet gas balance (maintain > 0.05 POL).
[ ] Watch `web-gallery` TV display for socket reconnection or display issues.

EMERGENCY PROTOCOLS:
1. OFFENSIVE ART IN LIVE GALLERY:
   Click "Hide" on the item in `web-admin`. The item will instantly disappear
   from the big screen with zero flicker. Log the incident in notes.
2. SPAM ATTACK OR BOT ACTIVITY:
   Toggle the "KILL SWITCH" in `web-admin` Dashboard. This freezes new mints
   while allowing the TV wall to continue operating smoothly.
3. OUT OF GAS:
   Alert team lead or top up minter private key address using testnet faucet.

DO'S & DON'TS:
+ DO stay attentive to the admin screen during rush hours.
+ DO remain calm and professional if inappropriate content appears.
- DON'T leave the admin dashboard unattended or unlocked.
- DON'T disclose admin tokens or private keys to anyone.
================================================================================
```
