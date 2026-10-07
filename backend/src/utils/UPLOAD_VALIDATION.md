# Upload validation handoff

`../middleware/validate.ts` exports `validateUpload` and
`createUploadMiddleware({ maxKb })`. Mount the middleware before the artwork
route handler, then pass `req.upload.bytes`, `req.upload.sha256`, and
`req.upload.nickname` to the pipeline. The bytes are the original multer memory
buffer; do not re-encode them. Size is measured in KB of 1024 bytes, inclusive.
Validation failures respond with `{ code, message }`; oversize is HTTP 413 and
other invalid inputs are HTTP 400. The route, rate limiter, kill switch, storage,
and queue remain the route owner's responsibility.

`nickname.ts` re-exports the existing shared nickname filter because this checkout
has no backend nickname filter. The shared policy trims nicknames, counts Unicode
characters, and rejects its blocked words.

## Tests

`validate.test.ts` uses Vitest and Supertest with a throwaway Express application.
With dependencies installed, run from `backend/`:

```sh
npm test -- src/utils/validate.test.ts
```

The package owner needs to supply `supertest`, `@types/supertest`, and
`@types/multer` as development dependencies; the current backend manifest does not
include them. Package manifests and lockfiles are outside this issue's ownership
and were not edited. Validation used an isolated dependency installation and
source copy under `/tmp/graffiti-upload-validation`, including a strict TypeScript
check. The new suite has 43 cases; the existing shared nickname suite adds 3.

`WORKSPLIT.md` is absent in this checkout. The issue number was not supplied;
include `Closes #<issue-number>` when preparing the PR.
