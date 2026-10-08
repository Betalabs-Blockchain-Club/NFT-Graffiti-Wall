# AGENT.md — `web-admin/` (Moderation & Ops)

## 1. Purpose / Function
Staff-only control room: mint prepared art to publish it, hide published work, monitor mint health + wallet balance, select the IPFS provider, and reset the wall.

## 2. Inputs
- `GET /api/gallery?status=pending|approved|minted|hidden` (queue), `GET /api/health`.
- Actions (Bearer `ADMIN_TOKEN`): `POST /api/admin/artworks/:id/mint|hide|restore|retry-ipfs`, `POST /api/admin/reset {confirm:'ARCHIVE YYYY-MM-DD'}`, `PUT /api/admin/config {KILL_SWITCH, IPFS_PROVIDER}`.
- Env: `VITE_API_URL`.

## 3. Outputs
- Confirmed mints → backend DB `approved` → gallery WS `new`; hide/restore emits `hide|new`.
- Ops signals: queue depth, failed jobs (retry button), balance warning, network mode indicator.

## 4. Functions / Responsibilities
1. `pages/Queue.tsx` — pending grid with Mint NFT/Hide and IPFS retry actions.
2. `pages/Dashboard.tsx` — live health, runtime controls, typed archive reset.
3. `components/NetworkSwitch.tsx` — `pinata|kubo` provider and minting kill switch (via backend config).
4. `components/QueueHealth.tsx` — chain/IPFS status, queue depth, and POL wallet balance; red alert below `0.01 POL`.
5. Auth: store `ADMIN_TOKEN` in memory (not localStorage on shared laptop), auto-lock after 5 min.
6. Reset flow requires the exact current UTC confirmation phrase.

## 5. Interfaces
- Only writer of publish/hide state. Gallery/kiosk never change it.
- Changing admin endpoints = update here + `docs/api.md`.

## 6. Dependencies
- React + Vite + TS, Tailwind. Same backend as kiosk/gallery.

## 7. File layout
```text
web-admin/
├── AGENT.md
├── src/pages/Queue.tsx
├── src/pages/Dashboard.tsx
└── src/components/NetworkSwitch.tsx
```

## 8. Definition of Done
- [ ] Mint publishes after chain confirmation; hide removes from gallery in <3s.
- [ ] Kill switch blocks POST but not GET. Balance <0.01 POL shows red banner.
- [ ] Non-authed user gets 401 on all admin calls.

## 9. Non-goals
- No drawing, no public access. Never exposed on projector.

## 10. Member guide
1. `npm run dev` with `ADMIN_TOKEN` from backend `.env`.
2. Test with 2 browsers: admin hide → gallery disappears.
