import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStorage } from "../services/storage.js";
import { DEFAULT_CONFIG } from "./types.js";
import { closeDatabase, fixture, query, receipt, seed, TEST_DATABASE_URL } from "./testSupport.js";

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => { f = await fixture(); });
afterEach(async () => { await f.close(); });
afterAll(async () => { await closeDatabase(); });

describe("PostgreSQL storage", () => {
  it("runs the schema and seeds typed defaults without overwriting configuration", async () => {
    expect(await f.storage.getConfig()).toEqual(DEFAULT_CONFIG);
    await f.storage.setConfig({ KILL_SWITCH: true, IPFS_PROVIDER: "kubo" });
    const second = createStorage(TEST_DATABASE_URL);
    await second.ready;
    try {
      expect(await second.getConfig()).toEqual({ ...DEFAULT_CONFIG, KILL_SWITCH: true, IPFS_PROVIDER: "kubo" });
      expect(await second.getConfig("KILL_SWITCH")).toBe(true);
    } finally { await second.close(); }
  });

  it("initializes the schema exactly once and repeats it without duplicating defaults", async () => {
    const second = createStorage(TEST_DATABASE_URL);
    await second.ready;
    await second.close();
    const third = createStorage(TEST_DATABASE_URL);
    await third.ready;
    try {
      expect((await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM config")).rows[0]).toEqual({ n: 3 });
      expect((await third.getConfig())).toEqual(DEFAULT_CONFIG);
      for (const table of ["artworks", "votes", "likes", "api_rate_limits", "config", "archive_batches"]) {
        const row = (await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name=$1", [table])).rows[0];
        expect(row, `table ${table} should exist`).toEqual({ n: 1 });
      }
    } finally { await third.close(); }
  });

  it("inserts and retrieves shared Artwork fields with pending status", async () => {
    const input = { id: "new", nickname: "Artist", sha256: "A".repeat(64) };
    const inserted = await f.storage.insertArtwork({ ...input, status: "approved" } as typeof input);
    expect(inserted).toMatchObject({ ...input, sha256: "a".repeat(64), status: "pending", tokenId: null, imageCID: null });
    expect(await f.storage.getById("new")).toEqual(inserted);
    expect(await f.storage.getById("missing")).toBeUndefined();
    await expect(f.storage.insertArtwork(input)).rejects.toThrow();
  });

  it("updates every mint receipt field", async () => {
    await seed(f.storage);
    expect(await f.storage.setMinted(receipt)).toMatchObject({ ...receipt, status: "minted" });
  });

  it.each(["approved", "hidden"] as const)("preserves %s moderation when a mint finishes", async (status) => {
    await seed(f.storage, "art-1", status);
    expect((await f.storage.setMinted(receipt)).status).toBe(status);
  });

  it("rejects missing rows and invalid state updates", async () => {
    await expect(f.storage.setStatus("missing", "approved")).rejects.toThrow("Artwork not found");
    await expect(f.storage.setMinted(receipt)).rejects.toThrow("Artwork not found");
    await seed(f.storage);
    await expect(f.storage.setStatus("art-1", "unknown" as never)).rejects.toThrow("Invalid artwork status");
    await expect(f.storage.setMinted({ ...receipt, tokenId: NaN })).rejects.toThrow("Invalid mint receipt");
  });

  it("lists only the requested status and omits tokenId before minting", async () => {
    for (const status of ["pending", "minted", "approved", "hidden", "failed"] as const) await seed(f.storage, status, status);
    const page = await f.storage.list();
    expect(page.items.map((item) => item.id)).toEqual(["approved"]);
    expect(page.items[0]).not.toHaveProperty("tokenId");
    expect(page.items[0]).toMatchObject({ imageCID: "bafy-approved", imageUrl: "ipfs://bafy-approved" });
    expect((await f.storage.list({ status: "pending" })).items.map((item) => item.id)).toEqual(["pending"]);
  });

  it("paginates tied timestamps without duplicates or skipped artwork", async () => {
    for (const id of ["a", "b", "c", "d", "e"]) await seed(f.storage, id, "approved", "2026-10-08T00:00:00Z");
    const first = await f.storage.list({ limit: 2 });
    const second = await f.storage.list({ limit: 2, cursor: first.nextCursor! });
    const third = await f.storage.list({ limit: 2, cursor: second.nextCursor! });
    expect([...first.items, ...second.items, ...third.items].map((item) => item.id)).toEqual(["e", "d", "c", "b", "a"]);
    expect(third.nextCursor).toBeNull();
  });

  it("keeps pagination valid after the cursor artwork is hidden", async () => {
    for (const id of ["a", "b", "c"]) await seed(f.storage, id, "approved", "2026-10-08T00:00:00Z");
    const first = await f.storage.list({ limit: 1 });
    await f.storage.setStatus("c", "hidden");
    expect((await f.storage.list({ cursor: first.nextCursor! })).items.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("rejects invalid limits, cursors, and cross-status cursor reuse", async () => {
    for (const limit of [0, -1, 101, 1.5, NaN]) await expect(f.storage.list({ limit })).rejects.toThrow();
    await expect(f.storage.list({ cursor: "not-a-cursor" })).rejects.toThrow("Invalid gallery cursor");
    await seed(f.storage, "a", "approved"); await seed(f.storage, "b", "approved");
    const cursor = (await f.storage.list({ limit: 1 })).nextCursor!;
    await expect(f.storage.list({ status: "pending", cursor })).rejects.toThrow("Invalid gallery cursor");
  });

  it("parameterizes ids containing SQL punctuation", async () => {
    const id = "art'; DROP TABLE artworks;--";
    await seed(f.storage, id, "approved");
    expect((await f.storage.getById(id))?.id).toBe(id);
    expect((await f.storage.list()).items).toHaveLength(1);
  });

  it("updates configuration atomically and rejects arbitrary keys and wrong types", async () => {
    await f.storage.setConfig({ MODERATION_MODE: "mint_after_approve", KILL_SWITCH: true });
    const before = await f.storage.getConfig();
    for (const update of [{ KILL_SWITCH: "false" }, { IPFS_PROVIDER: "mock" }, { ADMIN_TOKEN: "secret" }, { MODERATION_MODE: "off" }]) {
      await expect(f.storage.setConfig(update as never)).rejects.toThrow("Unsupported config");
    }
    await expect(f.storage.setConfig({ KILL_SWITCH: false, IPFS_PROVIDER: "bad" } as never)).rejects.toThrow();
    expect(await f.storage.getConfig()).toEqual(before);
  });

  it("reads legacy plain-text config and replaces corrupt values with safe defaults", async () => {
    await f.query("UPDATE config SET value=$1 WHERE key='MODERATION_MODE'", ["mint_after_approve"]);
    await f.query("UPDATE config SET value=$1 WHERE key='KILL_SWITCH'", ["PRIVATE_DATA"]);
    expect(await f.storage.getConfig()).toEqual({ ...DEFAULT_CONFIG, MODERATION_MODE: "mint_after_approve" });
  });

  it("deduplicates the complete vote triple and aggregates category leaderboards", async () => {
    await seed(f.storage, "art-1", "approved");
    const vote = { artworkId: "art-1", category: "best", voterKey: "visitor-a" };
    await f.storage.addVote(vote);
    await expect(f.storage.addVote(vote)).rejects.toThrow("Vote already recorded");
    await f.storage.addVote({ ...vote, voterKey: "visitor-b" });
    await f.storage.addVote({ ...vote, category: "creative" });
    expect(await f.storage.leaderboard()).toEqual([
      { artworkId: "art-1", category: "best", votes: 2 }, { artworkId: "art-1", category: "creative", votes: 1 }
    ]);
    await f.storage.setStatus("art-1", "hidden");
    expect(await f.storage.leaderboard()).toEqual([]);
  });

  it("allows the same voter and category on different approved artwork", async () => {
    await seed(f.storage, "a", "approved"); await seed(f.storage, "b", "approved");
    const vote = { category: "best", voterKey: "visitor" };
    await f.storage.addVote({ ...vote, artworkId: "a" }); await f.storage.addVote({ ...vote, artworkId: "b" });
    expect(await f.storage.leaderboard()).toEqual([
      { artworkId: "a", category: "best", votes: 1 }, { artworkId: "b", category: "best", votes: 1 }
    ]);
  });

  it("archives without deleting artwork, votes, or config and records an audit batch", async () => {
    await seed(f.storage, "art-1", "approved");
    await f.storage.addVote({ artworkId: "art-1", category: "best", voterKey: "visitor" });
    await f.storage.setConfig({ KILL_SWITCH: true });
    const archived = await f.storage.archiveAll();
    expect(archived).toMatchObject({ artworkCount: 1, voteCount: 1 });
    expect((await f.storage.list()).items).toEqual([]);
    expect(await f.storage.getById("art-1")).toBeUndefined();
    expect(await f.storage.leaderboard()).toEqual([]);
    expect((await f.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM artworks")).rows[0]).toEqual({ n: 1 });
    expect((await f.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM votes")).rows[0]).toEqual({ n: 1 });
    expect((await f.query("SELECT artwork_count, vote_count FROM archive_batches WHERE id=$1", [archived.archiveId])).rows[0])
      .toMatchObject({ artwork_count: 1, vote_count: 1 });
    expect(await f.storage.getConfig("KILL_SWITCH")).toBe(true);
    await expect(f.storage.setStatus("art-1", "approved")).rejects.toThrow("Artwork not found");
    await expect(f.storage.setMinted(receipt)).rejects.toThrow("Artwork not found");
    expect(await f.storage.archiveAll()).toMatchObject({ artworkCount: 0, voteCount: 0 });
    await seed(f.storage, "art-2", "approved");
    expect((await f.storage.list()).items.map((item) => item.id)).toEqual(["art-2"]);
  });

  it("rolls back both the audit entry and archive marks if archiving fails", async () => {
    await seed(f.storage, "art-1", "approved");
    await f.query("CREATE OR REPLACE FUNCTION test_block_archive() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$ LANGUAGE plpgsql");
    await f.query("CREATE TRIGGER test_block_archive BEFORE UPDATE OF archived_at ON artworks FOR EACH ROW EXECUTE FUNCTION test_block_archive()");
    try {
      await expect(f.storage.archiveAll()).rejects.toThrow("test failure");
    } finally {
      await f.query("DROP TRIGGER IF EXISTS test_block_archive ON artworks");
      await f.query("DROP FUNCTION IF EXISTS test_block_archive()");
    }
    expect((await f.storage.getById("art-1"))?.status).toBe("approved");
    expect((await f.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM archive_batches")).rows[0]).toEqual({ n: 0 });
  });

  it("shares committed data across independent pools and closes only its own", async () => {
    const first = createStorage(TEST_DATABASE_URL);
    await first.ready;
    await seed(first);
    await first.close(); await first.close();
    const reopened = createStorage(TEST_DATABASE_URL);
    await reopened.ready;
    try {
      expect((await reopened.getById("art-1"))?.nickname).toBe("Pixel Fox");
    } finally { await reopened.close(); }
    await f.storage.close();
    expect((await f.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM artworks")).rows[0]).toEqual({ n: 1 });
  });
});
