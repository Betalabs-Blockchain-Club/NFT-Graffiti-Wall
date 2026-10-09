# PostgreSQL storage

`createStorage(DATABASE_URL)` connects through `pg.Pool` and exposes promise-based methods. Startup runs the PostgreSQL `schema.sql`, applies additive `ADD COLUMN IF NOT EXISTS` upgrades, and seeds defaults with `ON CONFLICT DO NOTHING`. The Render service must set `DATABASE_URL` to a Neon PostgreSQL URL with TLS required. Pool size is capped at five connections for the serverless/free service footprint.

The storage contract remains the same for artwork, moderation, cursor pagination, votes, likes, persistent request limits, and archive audit records. Gallery reads active artwork ordered by creation time then ID; approved remains the public default. Idempotency, vote uniqueness, and per-browser like uniqueness are enforced by PostgreSQL constraints. No storage operation deletes artwork, votes, config, or archive history.

SQLite data is imported separately with `npm run migrate:sqlite-to-neon -- [path/to/data.db]`. This tool opens the old SQLite file read-only and performs a repeatable additive import. Conflicting primary/unique keys are skipped rather than overwritten; review the reported conflict count and compare records before switching production traffic.

The mint queue remains in memory. PostgreSQL retains persisted artwork state but does not persist queue payloads, current stage, retry counts, or pinned image bytes. See the Render deployment section in the root README for the restart limitation and setup sequence.
