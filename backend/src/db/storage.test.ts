import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStorage } from "../services/storage.js";
import { DEFAULT_CONFIG } from "./types.js";
import { fixture, receipt, seed } from "./testSupport.js";

let f: ReturnType<typeof fixture>;
beforeEach(() => { f = fixture(); });
afterEach(() => { if (f.db.open) f.db.close(); });

describe("SQLite storage", () => {
  it("runs the schema and seeds typed defaults without overwriting configuration", () => {
    expect(f.storage.getConfig()).toEqual(DEFAULT_CONFIG);
    f.storage.setConfig({ KILL_SWITCH: true, IPFS_PROVIDER: "kubo" });
    const second = createStorage(f.db);
    expect(second.getConfig()).toEqual({ ...DEFAULT_CONFIG, KILL_SWITCH: true, IPFS_PROVIDER: "kubo" });
    expect(second.getConfig("KILL_SWITCH")).toBe(true);
  });

  it("inserts and retrieves shared Artwork fields with pending status", () => {
    const input = { id: "new", nickname: "Artist", sha256: "A".repeat(64) };
    const inserted = f.storage.insertArtwork({ ...input, status: "approved" } as typeof input);
    expect(inserted).toMatchObject({ ...input, sha256: "a".repeat(64), status: "pending", tokenId: null, imageCID: null });
    expect(f.storage.getById("new")).toEqual(inserted);
    expect(f.storage.getById("missing")).toBeUndefined();
    expect(() => f.storage.insertArtwork(input)).toThrow();
  });

  it("updates every mint receipt field", () => {
    seed(f.storage);
    expect(f.storage.setMinted(receipt)).toMatchObject({ ...receipt, status: "minted" });
  });

  it.each(["approved", "hidden"] as const)("preserves %s moderation when a mint finishes", (status) => {
    seed(f.storage, "art-1", status);
    expect(f.storage.setMinted(receipt).status).toBe(status);
  });

  it("rejects missing rows and invalid state updates", () => {
    expect(() => f.storage.setStatus("missing", "approved")).toThrow("Artwork not found");
    expect(() => f.storage.setMinted(receipt)).toThrow("Artwork not found");
    seed(f.storage);
    expect(() => f.storage.setStatus("art-1", "unknown" as never)).toThrow("Invalid artwork status");
    expect(() => f.storage.setMinted({ ...receipt, tokenId: NaN })).toThrow("Invalid mint receipt");
  });

  it("lists only the requested status and omits tokenId before minting", () => {
    for (const status of ["pending", "minted", "approved", "hidden", "failed"] as const) seed(f.storage, status, status);
    const page = f.storage.list();
    expect(page.items.map((item) => item.id)).toEqual(["approved"]);
    expect(page.items[0]).not.toHaveProperty("tokenId");
    expect(page.items[0]).toMatchObject({ imageCID: "bafy-approved", imageUrl: "ipfs://bafy-approved" });
    expect(f.storage.list({ status: "pending" }).items.map((item) => item.id)).toEqual(["pending"]);
  });

  it("paginates tied timestamps without duplicates or skipped artwork", () => {
    for (const id of ["a", "b", "c", "d", "e"]) seed(f.storage, id, "approved", "2026-10-08T00:00:00Z");
    const first = f.storage.list({ limit: 2 });
    const second = f.storage.list({ limit: 2, cursor: first.nextCursor! });
    const third = f.storage.list({ limit: 2, cursor: second.nextCursor! });
    expect([...first.items, ...second.items, ...third.items].map((item) => item.id)).toEqual(["e", "d", "c", "b", "a"]);
    expect(third.nextCursor).toBeNull();
  });

  it("keeps pagination valid after the cursor artwork is hidden", () => {
    for (const id of ["a", "b", "c"]) seed(f.storage, id, "approved", "2026-10-08T00:00:00Z");
    const first = f.storage.list({ limit: 1 });
    f.storage.setStatus("c", "hidden");
    expect(f.storage.list({ cursor: first.nextCursor! }).items.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("rejects invalid limits, cursors, and cross-status cursor reuse", () => {
    for (const limit of [0, -1, 101, 1.5, NaN]) expect(() => f.storage.list({ limit })).toThrow();
    expect(() => f.storage.list({ cursor: "not-a-cursor" })).toThrow("Invalid gallery cursor");
    seed(f.storage, "a", "approved"); seed(f.storage, "b", "approved");
    const cursor = f.storage.list({ limit: 1 }).nextCursor!;
    expect(() => f.storage.list({ status: "pending", cursor })).toThrow("Invalid gallery cursor");
  });

  it("parameterizes ids containing SQL punctuation", () => {
    const id = "art'; DROP TABLE artworks;--";
    seed(f.storage, id, "approved");
    expect(f.storage.getById(id)?.id).toBe(id);
    expect(f.storage.list().items).toHaveLength(1);
  });

  it("updates configuration atomically and rejects arbitrary keys and wrong types", () => {
    f.storage.setConfig({ MODERATION_MODE: "mint_after_approve", KILL_SWITCH: true });
    const before = f.storage.getConfig();
    for (const update of [{ KILL_SWITCH: "false" }, { IPFS_PROVIDER: "mock" }, { ADMIN_TOKEN: "secret" }, { MODERATION_MODE: "off" }]) {
      expect(() => f.storage.setConfig(update as never)).toThrow("Unsupported config");
    }
    expect(() => f.storage.setConfig({ KILL_SWITCH: false, IPFS_PROVIDER: "bad" } as never)).toThrow();
    expect(f.storage.getConfig()).toEqual(before);
  });

  it("reads legacy plain-text config and replaces corrupt values with safe defaults", () => {
    f.db.prepare("UPDATE config SET value=? WHERE key='MODERATION_MODE'").run("mint_after_approve");
    f.db.prepare("UPDATE config SET value=? WHERE key='KILL_SWITCH'").run("PRIVATE_DATA");
    expect(f.storage.getConfig()).toEqual({ ...DEFAULT_CONFIG, MODERATION_MODE: "mint_after_approve" });
  });

  it("deduplicates the complete vote triple and aggregates category leaderboards", () => {
    seed(f.storage, "art-1", "approved");
    const vote = { artworkId: "art-1", category: "best", voterKey: "visitor-a" };
    f.storage.addVote(vote);
    expect(() => f.storage.addVote(vote)).toThrow("Vote already recorded");
    f.storage.addVote({ ...vote, voterKey: "visitor-b" });
    f.storage.addVote({ ...vote, category: "creative" });
    expect(f.storage.leaderboard()).toEqual([
      { artworkId: "art-1", category: "best", votes: 2 }, { artworkId: "art-1", category: "creative", votes: 1 }
    ]);
    f.storage.setStatus("art-1", "hidden");
    expect(f.storage.leaderboard()).toEqual([]);
  });

  it("allows the same voter and category on different approved artwork", () => {
    seed(f.storage, "a", "approved"); seed(f.storage, "b", "approved");
    const vote = { category: "best", voterKey: "visitor" };
    f.storage.addVote({ ...vote, artworkId: "a" }); f.storage.addVote({ ...vote, artworkId: "b" });
    expect(f.storage.leaderboard()).toEqual([
      { artworkId: "a", category: "best", votes: 1 }, { artworkId: "b", category: "best", votes: 1 }
    ]);
  });

  it("archives without deleting artwork, votes, or config and records an audit batch", () => {
    seed(f.storage, "art-1", "approved");
    f.storage.addVote({ artworkId: "art-1", category: "best", voterKey: "visitor" });
    f.storage.setConfig({ KILL_SWITCH: true });
    const archived = f.storage.archiveAll();
    expect(archived).toMatchObject({ artworkCount: 1, voteCount: 1 });
    expect(f.storage.list().items).toEqual([]);
    expect(f.storage.getById("art-1")).toBeUndefined();
    expect(f.storage.leaderboard()).toEqual([]);
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM artworks").get()).toEqual({ n: 1 });
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM votes").get()).toEqual({ n: 1 });
    expect(f.db.prepare("SELECT * FROM archive_batches WHERE id=?").get(archived.archiveId)).toMatchObject({ artwork_count: 1, vote_count: 1 });
    expect(f.storage.getConfig("KILL_SWITCH")).toBe(true);
    expect(() => f.storage.setStatus("art-1", "approved")).toThrow("Artwork not found");
    expect(() => f.storage.setMinted(receipt)).toThrow("Artwork not found");
    expect(f.storage.archiveAll()).toMatchObject({ artworkCount: 0, voteCount: 0 });
    seed(f.storage, "art-2", "approved");
    expect(f.storage.list().items.map((item) => item.id)).toEqual(["art-2"]);
  });

  it("upgrades the original schema without losing existing rows", () => {
    const legacy = new Database(":memory:");
    try {
      legacy.exec(`CREATE TABLE artworks(id TEXT PRIMARY KEY,token_id INTEGER,nickname TEXT NOT NULL,image_cid TEXT,
        metadata_cid TEXT,sha256 TEXT NOT NULL,tx_hash TEXT,block_number INTEGER,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL);
        INSERT INTO artworks(id,nickname,sha256,status,created_at) VALUES ('old','Artist','${"a".repeat(64)}','approved','2026-10-07 00:00:00');`);
      const storage = createStorage(legacy);
      expect(storage.getById("old")?.status).toBe("approved");
      expect(storage.archiveAll().artworkCount).toBe(1);
      expect(legacy.prepare("SELECT id FROM artworks").get()).toEqual({ id: "old" });
    } finally { legacy.close(); }
  });

  it("rolls back both the audit entry and archive marks if archiving fails", () => {
    seed(f.storage, "art-1", "approved");
    f.db.exec("CREATE TRIGGER prevent_archive BEFORE UPDATE OF archived_at ON artworks BEGIN SELECT RAISE(ABORT,'test failure'); END");
    expect(() => f.storage.archiveAll()).toThrow("test failure");
    expect(f.storage.getById("art-1")?.status).toBe("approved");
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM archive_batches").get()).toEqual({ n: 0 });
  });

  it("persists file-backed data and closes only connections it owns", () => {
    const directory = mkdtempSync(join(tmpdir(), "graffiti-storage-"));
    try {
      const path = join(directory, "test.sqlite");
      const first = createStorage(path);
      seed(first);
      first.close(); first.close();
      const reopened = createStorage(path);
      try { expect(reopened.getById("art-1")?.nickname).toBe("Pixel Fox"); } finally { reopened.close(); }
      f.storage.close();
      expect(f.db.open).toBe(true);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
