import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStorage, type Storage } from "../services/storage.js";
import { closeDatabase, query, resetDatabase, seed, TEST_DATABASE_URL } from "./testSupport.js";

const BROWSER_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const BROWSER_B = "9c858901-8a57-4791-81fe-4c455b099bc9";
const MIGRATE_SCRIPT = fileURLToPath(new URL("../../../scripts/migrate-sqlite-to-postgres.mjs", import.meta.url));

let storage: Storage;
beforeEach(async () => { await resetDatabase(); storage = createStorage(TEST_DATABASE_URL); await storage.ready; });
afterEach(async () => { await storage.close(); });
afterAll(async () => { await closeDatabase(); });

describe("PostgreSQL schema initialization", () => {
  it("creates every table, index, and seeded default exactly once", async () => {
    for (const table of ["artworks", "votes", "likes", "api_rate_limits", "config", "archive_batches"]) {
      const found = (await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name=$1", [table])).rows[0];
      expect(found, `table ${table}`).toEqual({ n: 1 });
    }
    for (const index of ["artworks_gallery", "artworks_idempotency_key", "votes_artwork", "likes_artwork", "api_rate_limits_window"]) {
      const found = (await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND indexname=$1", [index])).rows[0];
      expect(found, `index ${index}`).toEqual({ n: 1 });
    }
    expect(await storage.getConfig()).toEqual({ MODERATION_MODE: "display_after_approve", KILL_SWITCH: false, IPFS_PROVIDER: "pinata" });
    expect((await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM config")).rows[0]).toEqual({ n: 3 });
  });

  it("re-runs initialization additively without dropping rows or duplicating defaults", async () => {
    await seed(storage, "keep-me", "approved");
    const second = createStorage(TEST_DATABASE_URL);
    await second.ready;
    try {
      expect((await second.getById("keep-me"))?.status).toBe("approved");
      expect((await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM config")).rows[0]).toEqual({ n: 3 });
    } finally { await second.close(); }
  });
});

describe("PostgreSQL CRUD operations", () => {
  it("creates, reads, updates receipt fields, and reads the certificate", async () => {
    await seed(storage, "art-1", "pending");
    const minted = await storage.setMinted({ id: "art-1", tokenId: 9, txHash: "0xabc", blockNumber: 77, imageCID: "bafy-img", metadataCID: "bafy-meta" });
    expect(minted).toMatchObject({ tokenId: 9, txHash: "0xabc", blockNumber: 77, imageCID: "bafy-img", status: "minted" });
    expect(await storage.getCertificateDetails("art-1")).toMatchObject({ txHash: "0xabc" });
    await expect(storage.getCertificateDetails("missing")).rejects.toThrow("certificate data not found");
  });

  it("resolves a stored idempotency key and keeps keys unique", async () => {
    await storage.insertArtwork({ id: "art-1", nickname: "Artist", sha256: "a".repeat(64), idempotencyKey: "key-1" });
    expect((await storage.getByIdempotencyKey("key-1"))?.id).toBe("art-1");
    expect(await storage.getByIdempotencyKey("missing")).toBeUndefined();
    await expect(storage.insertArtwork({ id: "art-2", nickname: "Artist", sha256: "b".repeat(64), idempotencyKey: "key-1" }))
      .rejects.toMatchObject({ code: "23505" });
  });
});

describe("PostgreSQL transactions", () => {
  it("rolls the audit batch and archive marks back together when an update fails", async () => {
    await seed(storage, "art-1", "approved");
    await storage.addVote({ artworkId: "art-1", category: "best", voterKey: "visitor" });
    await query("CREATE OR REPLACE FUNCTION test_block_archive() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'rollback'; END; $$ LANGUAGE plpgsql");
    await query("CREATE TRIGGER test_block_archive BEFORE UPDATE OF archived_at ON artworks FOR EACH ROW EXECUTE FUNCTION test_block_archive()");
    try {
      await expect(storage.archiveAll()).rejects.toThrow("rollback");
    } finally {
      await query("DROP TRIGGER IF EXISTS test_block_archive ON artworks");
      await query("DROP FUNCTION IF EXISTS test_block_archive()");
    }
    expect((await storage.getById("art-1"))?.status).toBe("approved");
    expect((await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM archive_batches")).rows[0]).toEqual({ n: 0 });
  });

  it("applies a multi-key configuration update in a single transaction", async () => {
    const updated = await storage.setConfig({ MODERATION_MODE: "mint_after_approve", KILL_SWITCH: true });
    expect(updated).toMatchObject({ MODERATION_MODE: "mint_after_approve", KILL_SWITCH: true, IPFS_PROVIDER: "pinata" });
  });
});

describe("PostgreSQL likes and duplicate-vote protection", () => {
  it("rejects a duplicate vote triple but accepts distinct voters and categories", async () => {
    await seed(storage, "art-1", "approved");
    await storage.addVote({ artworkId: "art-1", category: "best", voterKey: "v1" });
    await expect(storage.addVote({ artworkId: "art-1", category: "best", voterKey: "v1" }))
      .rejects.toMatchObject({ code: "duplicate-vote", status: 409 });
    await storage.addVote({ artworkId: "art-1", category: "best", voterKey: "v2" });
    await storage.addVote({ artworkId: "art-1", category: "creative", voterKey: "v1" });
    expect(await storage.leaderboard()).toEqual([
      { artworkId: "art-1", category: "best", votes: 2 },
      { artworkId: "art-1", category: "creative", votes: 1 }
    ]);
  });

  it("keeps likes idempotent per browser and toggles them off", async () => {
    await seed(storage, "art-1", "approved");
    expect(await storage.setLike({ artworkId: "art-1", browserId: BROWSER_A, liked: true })).toMatchObject({ likes: 1, likedByMe: true });
    expect(await storage.setLike({ artworkId: "art-1", browserId: BROWSER_A, liked: true })).toMatchObject({ likes: 1, likedByMe: true });
    expect((await storage.likeSummary(BROWSER_B))[0]).toMatchObject({ artworkId: "art-1", likes: 1, likedByMe: 0 });
    expect(await storage.setLike({ artworkId: "art-1", browserId: BROWSER_A, liked: false })).toMatchObject({ likes: 0, likedByMe: false });
    expect((await storage.likeSummary(BROWSER_A))[0]).toMatchObject({ likes: 0, likedByMe: 0 });
  });

  it("rejects malformed likes and likes on unpublished artwork", async () => {
    await seed(storage, "art-1", "pending");
    await expect(storage.setLike({ artworkId: "art-1", browserId: BROWSER_A, liked: true })).rejects.toThrow("not available for liking");
    await expect(storage.setLike({ artworkId: "art-1", browserId: "not-a-uuid", liked: true })).rejects.toThrow("browserId must be a UUID v4");
    await expect(storage.setLike({ artworkId: "art-1", browserId: BROWSER_A, liked: "yes" as never })).rejects.toThrow("liked must be a boolean");
  });
});

describe("PostgreSQL moderation", () => {
  it("preserves approved or hidden status when a mint finishes", async () => {
    await seed(storage, "art-1", "approved");
    expect((await storage.setMinted({ id: "art-1", tokenId: 1, txHash: "0x1", blockNumber: 1, imageCID: "a", metadataCID: "b" })).status).toBe("approved");
    await seed(storage, "art-2", "hidden");
    expect((await storage.setMinted({ id: "art-2", tokenId: 2, txHash: "0x2", blockNumber: 2, imageCID: "a", metadataCID: "b" })).status).toBe("hidden");
  });

  it("only archives approved artwork through archiveArtwork", async () => {
    await seed(storage, "art-1", "pending");
    await expect(storage.archiveArtwork("art-1")).rejects.toMatchObject({ code: "not-ready", status: 409 });
    await storage.setStatus("art-1", "approved");
    const archived = await storage.archiveArtwork("art-1");
    expect(archived).toMatchObject({ artworkCount: 1 });
    expect(await storage.getById("art-1")).toBeUndefined();
  });
});

describe("PostgreSQL gallery queries", () => {
  it("defaults to approved, filters by status, and paginates without duplicates", async () => {
    for (const id of ["a", "b", "c", "d"]) await seed(storage, id, "approved", "2026-10-08T00:00:00Z");
    await seed(storage, "hidden-1", "hidden");
    expect((await storage.list()).items.map((item) => item.id)).toEqual(["d", "c", "b", "a"]);
    const first = await storage.list({ limit: 2 });
    const second = await storage.list({ limit: 2, cursor: first.nextCursor! });
    expect([...first.items, ...second.items].map((item) => item.id)).toEqual(["d", "c", "b", "a"]);
    expect(second.nextCursor).toBeNull();
    expect((await storage.list({ status: "hidden" })).items.map((item) => item.id)).toEqual(["hidden-1"]);
  });

  it("rejects malformed gallery queries", async () => {
    await expect(storage.list({ status: "bogus" as never })).rejects.toThrow("Invalid gallery status");
    await expect(storage.list({ limit: 0 })).rejects.toThrow();
    await expect(storage.list({ cursor: "not-a-cursor" })).rejects.toThrow("Invalid gallery cursor");
  });
});

describe("SQLite to PostgreSQL migration conflict handling", () => {
  it("imports rows idempotently, leaves key conflicts untouched, and advances sequences", async () => {
    const directory = mkdtempSync(join(tmpdir(), "graffiti-migrate-"));
    const sourcePath = join(directory, "source.db");
    try {
      const source = new Database(sourcePath);
      source.exec(`
        CREATE TABLE artworks(id TEXT PRIMARY KEY, token_id INTEGER, nickname TEXT NOT NULL, image_cid TEXT,
          metadata_cid TEXT, sha256 TEXT NOT NULL, tx_hash TEXT, block_number INTEGER, minted_at TEXT,
          status TEXT NOT NULL, created_at TEXT NOT NULL, archived_at TEXT, idempotency_key TEXT);
        CREATE TABLE votes(id INTEGER PRIMARY KEY, artwork_id TEXT, category TEXT, voter_key TEXT, created_at TEXT);
        CREATE TABLE likes(id INTEGER PRIMARY KEY, artwork_id TEXT, browser_id TEXT, created_at TEXT);
        CREATE TABLE api_rate_limits(bucket_key TEXT, window_start INTEGER, request_count INTEGER);
        CREATE TABLE config(key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE archive_batches(id TEXT, created_at TEXT, artwork_count INTEGER, vote_count INTEGER);
        INSERT INTO artworks(id,token_id,nickname,sha256,status,created_at,idempotency_key)
          VALUES('mig-1',5,'SQLite Artist','${"a".repeat(64)}','approved','2026-10-01T00:00:00Z','key-1');
        INSERT INTO votes(id,artwork_id,category,voter_key,created_at) VALUES(9,'mig-1','best','v1','2026-10-01T00:00:00Z');
        INSERT INTO likes(id,artwork_id,browser_id,created_at) VALUES(4,'mig-1','${BROWSER_A}','2026-10-01T00:00:00Z');
        INSERT INTO config(key,value) VALUES('MODERATION_MODE','mint_after_approve'),('KILL_SWITCH','true');
        INSERT INTO archive_batches(id,created_at,artwork_count,vote_count) VALUES('batch-1','2026-10-02T00:00:00Z',3,2);
      `);
      source.close();

      await storage.insertArtwork({ id: "mig-1", nickname: "Postgres Artist", sha256: "b".repeat(64), idempotencyKey: "key-1" });
      await storage.setConfig({ MODERATION_MODE: "display_after_approve" });

      const firstRun = execFileSync(process.execPath, [MIGRATE_SCRIPT, sourcePath], {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        encoding: "utf8"
      });
      expect(firstRun).toContain("conflicts skipped");

      // A pre-existing primary key is preserved (ON CONFLICT DO NOTHING).
      expect((await storage.getById("mig-1"))?.nickname).toBe("Postgres Artist");
      expect(await storage.getConfig("MODERATION_MODE")).toBe("display_after_approve");
      expect((await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM votes")).rows[0]).toEqual({ n: 1 });
      expect((await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM likes")).rows[0]).toEqual({ n: 1 });
      expect((await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM archive_batches")).rows[0]).toEqual({ n: 1 });

      // Re-running is repeatable: no duplicates and no unique violations.
      const secondRun = execFileSync(process.execPath, [MIGRATE_SCRIPT, sourcePath], {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        encoding: "utf8"
      });
      expect(secondRun).toContain("0 inserted");
      expect((await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM votes")).rows[0]).toEqual({ n: 1 });

      // Serial sequences were advanced past the imported ids.
      const nextVote = (await query<{ id: number }>("INSERT INTO votes(artwork_id,category,voter_key) VALUES('mig-1','best','v2') RETURNING id::int AS id")).rows[0];
      expect(nextVote.id).toBeGreaterThan(9);
      const nextLike = (await query<{ id: number }>("INSERT INTO likes(artwork_id,browser_id) VALUES('mig-1',$1) RETURNING id::int AS id", [BROWSER_B])).rows[0];
      expect(nextLike.id).toBeGreaterThan(4);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
