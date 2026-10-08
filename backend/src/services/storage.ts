import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { requiredString, StorageError } from "../db/errors.js";
import { artworkFromRow, DEFAULT_CONFIG, GALLERY_STATUSES, toGalleryItem, validConfigEntry,
  type Artwork, type ArtworkRow, type ArtworkStatus, type Config, type GalleryStatus } from "../db/types.js";

export interface InsertArtwork {
  id: string; nickname: string; sha256: string; imageCID?: string; metadataCID?: string; createdAt?: string; idempotencyKey?: string;
}
export interface MintedArtwork {
  id: string; tokenId: number; txHash: string; blockNumber: number; imageCID: string; metadataCID: string;
}
export interface VoteInput { artworkId: string; category: string; voterKey: string }
export interface ListOptions { status?: GalleryStatus; limit?: number; cursor?: string }

export function createStorage(dbPathOrDb: string | Database.Database) {
  const owned = typeof dbPathOrDb === "string";
  const db = owned ? new Database(dbPathOrDb) : dbPathOrDb;
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  // Existing expo databases predate soft archiving. Upgrade without losing rows.
  const columns = db.prepare("PRAGMA table_info(artworks)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "archived_at")) {
    db.exec("ALTER TABLE artworks ADD COLUMN archived_at TEXT");
  }
  if (!columns.some((column) => column.name === "idempotency_key")) {
    db.exec("ALTER TABLE artworks ADD COLUMN idempotency_key TEXT");
  }
  if (!columns.some((column) => column.name === "minted_at")) {
    db.exec("ALTER TABLE artworks ADD COLUMN minted_at TEXT");
  }
  db.exec("CREATE INDEX IF NOT EXISTS artworks_gallery ON artworks(status, archived_at, created_at DESC, id DESC)");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS artworks_idempotency_key ON artworks(idempotency_key) WHERE idempotency_key IS NOT NULL");
  db.exec("CREATE INDEX IF NOT EXISTS votes_artwork ON votes(artwork_id)");
  db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
      db.prepare("INSERT OR IGNORE INTO config(key,value) VALUES (?,?)").run(key, JSON.stringify(value));
    }
  })();

  function getById(id: string): Artwork | undefined {
    const row = db.prepare("SELECT * FROM artworks WHERE id=? AND archived_at IS NULL").get(id) as ArtworkRow | undefined;
    return row ? artworkFromRow(row) : undefined;
  }
  function mustExist(id: string): Artwork {
    const artwork = getById(id);
    if (!artwork) throw new StorageError("not-found", "Artwork not found", 404);
    return artwork;
  }
  function getConfig(): Config;
  function getConfig<K extends keyof Config>(key: K): Config[K];
  function getConfig(key?: keyof Config): Config | Config[keyof Config] {
    const config = { ...DEFAULT_CONFIG };
    for (const name of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
      const row = db.prepare("SELECT value FROM config WHERE key=?").get(name) as { value: string } | undefined;
      if (!row) continue;
      // Accept legacy plain-text enum values as well as typed JSON values.
      // Invalid/corrupt values fall back to defaults rather than leaking data.
      let value: unknown;
      try { value = JSON.parse(row.value); } catch { value = row.value; }
      if (validConfigEntry(name, value)) Object.assign(config, { [name]: value });
    }
    return key === undefined ? config : config[key];
  }
  function setConfig(update: Partial<Config>): Config {
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      throw new StorageError("invalid-config", "Config must be an object");
    }
    for (const [key, value] of Object.entries(update)) {
      if (!validConfigEntry(key, value)) throw new StorageError("invalid-config", "Unsupported config key or value");
    }
    db.transaction(() => {
      for (const [key, value] of Object.entries(update)) {
        db.prepare("INSERT INTO config(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
          .run(key, JSON.stringify(value));
      }
    })();
    return getConfig();
  }

  return {
    insertArtwork(input: InsertArtwork): Artwork {
      requiredString(input.id, "id"); requiredString(input.nickname, "nickname", 64);
      if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new StorageError("invalid-input", "sha256 must be hex64");
      const date = input.createdAt === undefined ? new Date() : new Date(input.createdAt);
      if (!Number.isFinite(date.getTime())) throw new StorageError("invalid-input", "Invalid creation date");
      // New submissions cannot set their own moderation status or mint receipt.
      db.prepare("INSERT INTO artworks(id,nickname,sha256,image_cid,metadata_cid,status,created_at,idempotency_key) VALUES (?,?,?,?,?,'pending',?,?)")
        .run(input.id, input.nickname, input.sha256.toLowerCase(), input.imageCID ?? null, input.metadataCID ?? null, date.toISOString(), input.idempotencyKey ?? null);
      return mustExist(input.id);
    },
    getById,
    getByIdempotencyKey(key: string): Artwork | undefined {
      const row = db.prepare("SELECT * FROM artworks WHERE idempotency_key=?").get(key) as ArtworkRow | undefined;
      return row ? artworkFromRow(row) : undefined;
    },
    setPinned(id: string, imageCID: string, metadataCID: string): Artwork {
      mustExist(id);
      requiredString(imageCID, "imageCID"); requiredString(metadataCID, "metadataCID");
      db.prepare("UPDATE artworks SET image_cid=?,metadata_cid=? WHERE id=? AND archived_at IS NULL AND token_id IS NULL")
        .run(imageCID, metadataCID, id);
      return mustExist(id);
    },
    setMinted(input: MintedArtwork): Artwork {
      mustExist(input.id);
      if (!Number.isSafeInteger(input.tokenId) || input.tokenId < 0 || !Number.isSafeInteger(input.blockNumber) || input.blockNumber < 0) {
        throw new StorageError("invalid-input", "Invalid mint receipt numbers");
      }
      requiredString(input.txHash, "txHash"); requiredString(input.imageCID, "imageCID"); requiredString(input.metadataCID, "metadataCID");
      db.prepare(`UPDATE artworks SET token_id=?,tx_hash=?,block_number=?,image_cid=?,metadata_cid=?,minted_at=?,
        status=CASE WHEN status IN ('approved','hidden') THEN status ELSE 'minted' END
        WHERE id=? AND archived_at IS NULL`).run(input.tokenId, input.txHash, input.blockNumber, input.imageCID, input.metadataCID, new Date().toISOString(), input.id);
      return mustExist(input.id);
    },
    getCertificateDetails(id: string) {
      const row = db.prepare("SELECT tx_hash,minted_at FROM artworks WHERE id=? AND archived_at IS NULL").get(id) as { tx_hash: string | null; minted_at: string | null } | undefined;
      if (!row?.tx_hash) throw new StorageError("not-found", "Minted artwork certificate data not found", 404);
      return { txHash: row.tx_hash, mintedAt: row.minted_at ?? "" };
    },
    setStatus(id: string, status: ArtworkStatus): Artwork {
      if (![...GALLERY_STATUSES, "failed"].includes(status)) throw new StorageError("invalid-input", "Invalid artwork status");
      mustExist(id);
      db.prepare("UPDATE artworks SET status=? WHERE id=? AND archived_at IS NULL").run(status, id);
      return mustExist(id);
    },
    list({ status = "approved", limit = 48, cursor }: ListOptions = {}) {
      if (!GALLERY_STATUSES.includes(status) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new StorageError("invalid-query", "Invalid gallery status or limit (1-100)");
      }
      let after: { createdAt: string; id: string; status: string } | undefined;
      if (cursor !== undefined) {
        try {
          if (typeof cursor !== "string" || cursor.length > 2048) throw new Error();
          after = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
          if (!after || typeof after.createdAt !== "string" || typeof after.id !== "string" || after.status !== status) throw new Error();
        } catch { throw new StorageError("invalid-query", "Invalid gallery cursor"); }
      }
      const rows = (after
        ? db.prepare(`SELECT * FROM artworks WHERE archived_at IS NULL AND status=?
            AND (created_at < ? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT ?`)
          .all(status, after.createdAt, after.createdAt, after.id, limit + 1)
        : db.prepare("SELECT * FROM artworks WHERE archived_at IS NULL AND status=? ORDER BY created_at DESC,id DESC LIMIT ?")
          .all(status, limit + 1)) as ArtworkRow[];
      const items = rows.slice(0, limit).map((row) => toGalleryItem(artworkFromRow(row)));
      const last = items.at(-1);
      return {
        items,
        nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id, status })).toString("base64url") : null
      };
    },
    getConfig, setConfig,
    addVote(input: VoteInput) {
      requiredString(input.artworkId, "artworkId"); requiredString(input.category, "category", 64); requiredString(input.voterKey, "voterKey");
      if (getById(input.artworkId)?.status !== "approved") throw new StorageError("not-found", "Artwork is not available for voting", 404);
      try {
        const result = db.prepare("INSERT INTO votes(artwork_id,category,voter_key) VALUES (?,?,?)")
          .run(input.artworkId, input.category, input.voterKey);
        return { id: Number(result.lastInsertRowid), ...input };
      } catch (error) {
        if ((error as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
          throw new StorageError("duplicate-vote", "Vote already recorded", 409);
        }
        throw error;
      }
    },
    leaderboard() {
      return db.prepare(`SELECT v.artwork_id AS artworkId,v.category,COUNT(*) AS votes FROM votes v
        JOIN artworks a ON a.id=v.artwork_id WHERE a.archived_at IS NULL AND a.status='approved'
        GROUP BY v.artwork_id,v.category ORDER BY votes DESC,v.artwork_id ASC,v.category ASC`).all() as
        { artworkId: string; category: string; votes: number }[];
    },
    archiveByStatus(status: ArtworkStatus, excludedIds: string[] = []) {
      if (!(GALLERY_STATUSES as readonly string[]).includes(status) && status !== "failed") {
        throw new StorageError("invalid-input", "Invalid artwork status");
      }
      const excludeSql = excludedIds.length ? ` AND id NOT IN (${excludedIds.map(() => "?").join(",")})` : "";
      const excludeVoteSql = excludedIds.length ? ` AND a.id NOT IN (${excludedIds.map(() => "?").join(",")})` : "";
      return db.transaction(() => {
        const rows = db.prepare(`SELECT id FROM artworks WHERE archived_at IS NULL AND status=?${excludeSql}`)
          .all(status, ...excludedIds) as { id: string }[];
        const ids = rows.map(({ id }) => id);
        const voteCount = ids.length ? (db.prepare(`SELECT COUNT(*) AS count FROM votes v
          JOIN artworks a ON a.id=v.artwork_id WHERE a.archived_at IS NULL AND a.status=?${excludeVoteSql}`)
          .get(status, ...excludedIds) as { count: number }).count : 0;
        const archiveId = randomUUID();
        const createdAt = new Date().toISOString();
        db.prepare("INSERT INTO archive_batches(id,created_at,artwork_count,vote_count) VALUES (?,?,?,?)")
          .run(archiveId, createdAt, ids.length, voteCount);
        if (ids.length) {
          db.prepare(`UPDATE artworks SET archived_at=? WHERE archived_at IS NULL AND status=?${excludeSql}`)
            .run(createdAt, status, ...excludedIds);
        }
        return { archiveId, artworkCount: ids.length, voteCount, ids };
      })();
    },
    archiveArtwork(id: string) {
      return db.transaction(() => {
        const artwork = mustExist(id);
        if (artwork.status !== "approved") throw new StorageError("not-ready", "Only published artwork can be removed from the gallery", 409);
        const voteCount = (db.prepare("SELECT COUNT(*) AS count FROM votes WHERE artwork_id=?").get(id) as { count: number }).count;
        const archiveId = randomUUID();
        const createdAt = new Date().toISOString();
        db.prepare("INSERT INTO archive_batches(id,created_at,artwork_count,vote_count) VALUES (?,?,1,?)").run(archiveId, createdAt, voteCount);
        db.prepare("UPDATE artworks SET archived_at=? WHERE id=? AND archived_at IS NULL").run(createdAt, id);
        return { archiveId, artworkCount: 1, voteCount, id };
      })();
    },
    archiveAll: db.transaction(() => {
      const artworkCount = (db.prepare("SELECT COUNT(*) AS count FROM artworks WHERE archived_at IS NULL").get() as { count: number }).count;
      const voteCount = (db.prepare("SELECT COUNT(*) AS count FROM votes v JOIN artworks a ON a.id=v.artwork_id WHERE a.archived_at IS NULL").get() as { count: number }).count;
      const archiveId = randomUUID(), createdAt = new Date().toISOString();
      db.prepare("INSERT INTO archive_batches(id,created_at,artwork_count,vote_count) VALUES (?,?,?,?)")
        .run(archiveId, createdAt, artworkCount, voteCount);
      db.prepare("UPDATE artworks SET archived_at=? WHERE archived_at IS NULL").run(createdAt);
      return { archiveId, artworkCount, voteCount };
    }),
    close() { if (owned && db.open) db.close(); }
  };
}

export type Storage = ReturnType<typeof createStorage>;
