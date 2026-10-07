# Realtime integration

Import `createRealtime` from `backend/src/ws/index.ts` and pass the application's
Node HTTP server plus `{ allowedOrigin }` (a string or array of origins).

```ts
const realtime = createRealtime(httpServer, { allowedOrigin: kioskOrigin });
// B5's onApproved hook:
realtime.emitNew(approvedGalleryItem);
// B5's onHidden hook:
realtime.emitHide(artworkId);
// Queue progress:
realtime.emitJob(jobId, mintJob);
// Application shutdown:
await realtime.close();
```

Member 4 owns mounting this factory and connecting those hooks in W1. No bootstrap,
queue, moderation, route, shared type, or API documentation files were changed.

## Frozen wire interface

- `/gallery` broadcasts `new` with the shared `GalleryItem`, and `hide` with `{ id }`.
  `emitNew` broadcasts approved items only, as required by `backend/AGENT.md`.
- `/status` receives `subscribe(jobId)` and joins the socket to `job:<jobId>`.
  `emitJob(jobId, job)` emits the shared `MintJob` only to that room. A payload
  whose `jobId` disagrees with the routing id is ignored.
- Non-string or blank subscriptions are ignored. Repeated subscriptions are
  idempotent; sockets may subscribe to multiple jobs. Socket.IO removes their room
  membership on disconnect. Reconnected clients subscribe again.
- No per-socket job history or backfill is stored. Clients recover missed updates
  through `GET /api/artworks/:jobId/status`.
- `allowedOrigin` configures Socket.IO's browser CORS handling; it is not job
  authorization. A client with a job id can subscribe to that job.
- `close()` returns a shared promise for repeated calls, disconnects clients, and
  closes the attached HTTP server. Call it during application shutdown.

## Standalone validation

`realtime.test.ts` creates a local HTTP server and connects real Socket.IO clients.
It covers two-kiosk isolation, gallery fanout, namespace separation, moderation,
polling, subscriptions, reconnects, CORS, and shutdown (16 tests).

With dependencies installed, run from `backend/`:

```sh
npm test -- src/ws/realtime.test.ts
```

The backend already declares `socket.io` and `vitest`. Its package owner must add
`socket.io-client` as a development dependency; package files are outside this
issue's ownership. Tests and strict TypeScript checking ran against copied source
with an isolated dependency installation in `/tmp/graffiti-upload-validation`.
Tests need permission to bind a local socket.

`WORKSPLIT.md` was absent from this checkout. The implementation follows the issue,
root `AGENT.md`, backend `AGENT.md`, and the existing shared types. It implements
the frozen WS interface without changing it. Use `Closes #<issue-number>` in the
PR body once the issue number is known.
