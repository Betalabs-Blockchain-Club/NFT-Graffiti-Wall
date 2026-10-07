# Storage and moderation integration

Member 4 mounts these factories in W1. This issue does not edit `src/index.ts` or
import realtime. Each router contains its full `/api/...` paths:

```ts
const storage = createStorage(dbPath); // or an existing better-sqlite3 Database
app.use(express.json());
app.use(createGalleryRouter({ storage, adminToken }));
app.use(createAdminRouter({ storage, adminToken, hooks: {
  onApproved: (item) => realtime.emitNew(item),
  onHidden: (id) => realtime.emitHide(id)
} }));
app.use(createVotesRouter({ storage }));
```

`adminAuth(adminToken)` is also available as a standalone middleware factory.
Admin tokens must be non-empty and contain no whitespace. Missing, malformed, or
incorrect Bearer credentials return 401. The middleware does not expose the token.

## Storage

- `createStorage(pathOrDb)` executes `schema.sql`, enables foreign keys, seeds
  defaults without replacing existing config, and upgrades the original artwork
  table with `archived_at` when necessary. Copy `schema.sql` alongside emitted DB
  modules when assembling the production build; TypeScript does not copy SQL.
- `insertArtwork({id, nickname, sha256, imageCID?, metadataCID?, createdAt?})`
  always creates pending artwork. Upload validation belongs to the upload issue.
- `getById(id)` reads active artwork; `setMinted(receipt)` stores the complete
  receipt while preserving an existing approved/hidden decision. `setStatus(id,
  status)` is an internal operation; only authenticated admin routes may use it
  to write approved/hidden. W1 must not wire queue moderation mode `off` to auto-
  approval; that older queue option conflicts with this issue's frozen policy.
- `list({status?, limit?, cursor?})` returns `{items, nextCursor}`. Default status
  is approved; limits are 1–100 (default 48). Cursors are opaque and tied to their
  status. Ordering is creation time descending, then id descending, with no
  offset pagination. Gallery statuses are pending/minted/approved/hidden; failed
  is a storage status and is not part of the frozen GalleryItem type.
- Shared `Artwork` and `GalleryItem` types are reused. `tokenId` is omitted from
  gallery items before minting. Image URLs use `ipfs://<CID>`.
- `getConfig()` returns the typed config object; `getConfig(key)` reads one value.
  `setConfig(partial)` validates and updates atomically. Supported keys are
  MODERATION_MODE (display_after_approve/mint_after_approve), KILL_SWITCH (boolean),
  and IPFS_PROVIDER (pinata/kubo). Defaults are display_after_approve, false,
  and pinata. Unknown keys cannot store or expose secrets.
- `addVote({artworkId, category, voterKey})` permits active approved artwork only.
  The unique triple returns duplicate-vote (409) when repeated. `leaderboard()`
  returns an array of `{artworkId, category, votes}`, excluding hidden/archived
  artwork and omitting voter keys.
- `archiveAll()` marks active artwork as archived and records an audit batch,
  all in one transaction. Artwork, votes, and config remain in SQLite. Archived
  artwork cannot be remoderated, minted, or voted on through active methods.
  `close()` closes only connections created by the factory; the caller owns
  injected database connections.

## Admin behavior

All `/api/admin` routes require the token. Approval/hiding invokes the injected
hook after the DB update. Repeating an action repeats its notification so callers
can retry after hook failures. Hook errors return a generic 500 without rolling
back the committed moderation change or exposing error details.

Reset requires exactly `ARCHIVE YYYY-MM-DD` for today's UTC date, including case
and spacing. It returns `{ok, archiveId, artworkCount, voteCount}`, retains all
data, and notifies onHidden for every previously approved artwork. All reset
notifications are attempted even if one fails. Clients can resync via REST.

Approved gallery reads are public. Every other requested status requires admin
authentication before query validation. Route parameter names are `:jobId`, as
required by the frozen decisions.

## Tests

From `backend/` with dependencies installed:

```sh
npm test -- src/db
```

Tests use real in-memory better-sqlite3 databases and Supertest with throwaway
Express apps. They also cover legacy migration, file persistence, cursor ties,
archive rollback, hook failures, and reset pagination. SQLite was updated to
12.11.1 with user authorization for compatibility with both Node 20 and Node 26;
Supertest and its types are declared development dependencies.

`WORKSPLIT.md` was absent from this checkout. The issue number was not supplied;
use `Closes #<issue-number>` in the PR body. This implements the frozen interfaces
without changing the shared REST/WS/types/QR contracts.
