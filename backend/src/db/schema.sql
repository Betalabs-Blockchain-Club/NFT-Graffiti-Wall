CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY, token_id BIGINT, nickname TEXT NOT NULL, image_cid TEXT,
  metadata_cid TEXT, sha256 TEXT NOT NULL, tx_hash TEXT, block_number BIGINT,
  minted_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','minted','approved','hidden','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), archived_at TIMESTAMPTZ,
  idempotency_key TEXT
);
CREATE TABLE IF NOT EXISTS votes (
  id BIGSERIAL PRIMARY KEY, artwork_id TEXT NOT NULL REFERENCES artworks(id),
  category TEXT NOT NULL DEFAULT 'best', voter_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (artwork_id, category, voter_key)
);
CREATE TABLE IF NOT EXISTS likes (
  id BIGSERIAL PRIMARY KEY, artwork_id TEXT NOT NULL REFERENCES artworks(id),
  browser_id TEXT NOT NULL CHECK(length(browser_id) = 36),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (artwork_id, browser_id)
);
CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key TEXT PRIMARY KEY, window_start BIGINT NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count > 0)
);
CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS archive_batches (
  id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL,
  artwork_count INTEGER NOT NULL, vote_count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS artworks_gallery ON artworks(status, archived_at, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS artworks_idempotency_key ON artworks(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS votes_artwork ON votes(artwork_id);
CREATE INDEX IF NOT EXISTS likes_artwork ON likes(artwork_id);
CREATE INDEX IF NOT EXISTS api_rate_limits_window ON api_rate_limits(window_start);
