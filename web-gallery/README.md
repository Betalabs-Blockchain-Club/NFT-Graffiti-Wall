# @graffiti/web-gallery

Live big-screen TV wall for the NFT Graffiti Wall expo booth.

## Features
- **Responsive 1080p Grid Layout:** Optimized for 1080p projectors and exhibition displays.
- **Real-time Live Sync:** Listens to Socket.IO `/gallery` namespace for `new` artwork events and instant `hide` moderation events (zero flicker).
- **REST Backfill & Reconnection:** Initial backfill via `GET /api/gallery?status=approved`, with 10s fallback polling and automatic deduplication upon reconnects.
- **NewArtToast & Confetti:** Celebratory confetti explosion and zoom-in spotlight card when new artworks drop.
- **Attract Overlay:** Ambient screensaver and empty-state overlay ("Draw it. Mint it. Own it.") with QR code linking to mobile verify/kiosk.
- **Vote Bars:** Automatic feature-detection for `GET /api/leaderboard` to render live community vote bars on artwork cards.

## Scripts
```bash
# Start standalone mock server with Socket.IO & REST fixtures
npm run mock

# Start Vite dev server
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

## Environment Variables
- `VITE_API_URL`: URL of the shared backend REST API. Set this to the production backend origin in every deployed frontend build; the local default is `http://localhost:3001`.
- `VITE_WS_URL`: Socket.IO URL for the same backend (defaults to `VITE_API_URL`).
- `VITE_IPFS_GATEWAY`: IPFS gateway base URL (default: `https://ipfs.io/ipfs`)

Gallery likes use this backend for both counts and writes. For deployment, set `VITE_API_URL` and `VITE_WS_URL` to the production backend, then configure backend `CORS_ORIGIN` to include this gallery's deployed origin (and every other deployed frontend origin that calls it). Set `LIKE_RATE_LIMIT_PER_MIN` to the per-browser write limit (default 60). Like counts and browser like state are read from the backend database; browser storage only retains the anonymous browser ID.
- `VITE_VERIFY_URL`: Public verify site base URL (default: current host)
- `VITE_KIOSK_URL`: Kiosk site base URL (optional)
