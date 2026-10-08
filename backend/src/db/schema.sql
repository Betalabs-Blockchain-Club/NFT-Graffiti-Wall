CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,            -- jobId (uuid)
  token_id INTEGER,               -- on-chain id after mint
  nickname TEXT NOT NULL,
  image_cid TEXT,
  metadata_cid TEXT,
  sha256 TEXT NOT NULL,           -- hex, no 0x
  tx_hash TEXT,
  block_number INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','minted','approved','hidden','failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artwork_id TEXT NOT NULL REFERENCES artworks(id),
  category TEXT NOT NULL DEFAULT 'best',
  voter_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (artwork_id, category, voter_key)
);
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS archive_batches (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  artwork_count INTEGER NOT NULL,
  vote_count INTEGER NOT NULL
);
