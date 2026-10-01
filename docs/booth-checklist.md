# Booth Checklist (print me)

## Morning boot (15 min)
- [ ] Minter balance > 0.05 test-ETH? (admin Dashboard)
- [ ] Contract reachable? (`GET /api/health {chain: ok}`)
- [ ] IPFS key valid? (test pin in admin)
- [ ] Test mint from kiosk → QR → phone verify on **cellular** ✅
- [ ] Gallery TV on, wall shows seed art, sound/confetti ok

## Roles
- Greeter: "60 seconds, draw, put it on-chain" + queue
- Moderator: admin Queue tab open, hide in <2 clicks
- Explainer: hash/CID/NFT 30-sec pitch + tamper demo

## Failure drills
- Wi-Fi drop → hotspot on, queue retries, tell visitors "your art is queued"
- IPFS/RPC down → switch to Kubo/localhost in admin NetworkSwitch
- Offensive art → Hide, reassure, continue
- Queue buildup → open 2nd kiosk, show gallery while waiting

## Nightly
- [ ] `node scripts/export-data.js`, backup `backend/data/`
- [ ] Top-voted tally screenshot, recharge devices
