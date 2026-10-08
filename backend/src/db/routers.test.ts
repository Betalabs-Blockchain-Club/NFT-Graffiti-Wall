import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminAuth } from "../middleware/adminAuth.js";
import { ADMIN_TOKEN, fixture, seed } from "./testSupport.js";

let f: ReturnType<typeof fixture>;
const auth = `Bearer ${ADMIN_TOKEN}`;
beforeEach(() => { f = fixture(); });
afterEach(() => { if (f.db.open) f.db.close(); vi.useRealTimers(); });

describe("gallery visibility", () => {
  it("publishes only approved artwork, including with the default status", async () => {
    for (const status of ["pending", "minted", "approved", "hidden", "failed"] as const) seed(f.storage, status, status);
    for (const path of ["/api/gallery", "/api/gallery?status=approved"]) {
      const response = await request(f.app).get(path);
      expect(response.status).toBe(200);
      expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(["approved"]);
    }
  });

  it.each(["pending", "minted", "hidden", "failed", "invalid"])("requires authentication for status=%s", async (status) => {
    expect((await request(f.app).get(`/api/gallery?status=${status}`)).status).toBe(401);
  });

  it("allows authenticated private listings and rejects malformed queries", async () => {
    seed(f.storage, "private", "pending");
    const pending = await request(f.app).get("/api/gallery?status=pending").set("Authorization", auth);
    expect(pending.status).toBe(200);
    expect(pending.body.items[0].id).toBe("private");
    for (const query of ["limit=0", "limit=101", "limit=abc", "limit=1.5", "limit=1&limit=2", "cursor=bad", "status=failed", "status=approved&status=pending"]) {
      expect((await request(f.app).get(`/api/gallery?${query}`).set("Authorization", auth)).status).toBe(400);
    }
  });

  it("paginates through the HTTP endpoint without exposing hidden artwork", async () => {
    for (const id of ["a", "b", "c"]) seed(f.storage, id, "approved", "2026-10-08T00:00:00Z");
    seed(f.storage, "private", "hidden");
    const first = await request(f.app).get("/api/gallery?limit=2");
    const second = await request(f.app).get("/api/gallery").query({ limit: 2, cursor: first.body.nextCursor });
    expect([...first.body.items, ...second.body.items].map((item: { id: string }) => item.id)).toEqual(["c", "b", "a"]);
    expect(second.body.nextCursor).toBeNull();
  });
});

describe("admin authentication and moderation", () => {
  const routes = [
    { method: "post", path: "/api/admin/artworks/art-1/mint" },
    { method: "post", path: "/api/admin/artworks/art-1/hide" },
    { method: "put", path: "/api/admin/config" },
    { method: "post", path: "/api/admin/reset" }
  ] as const;
  it.each(routes)("protects $method $path before accessing data", async ({ method, path }) => {
    for (const token of [undefined, "Bearer wrong", `Basic ${ADMIN_TOKEN}`, "Bearer"]) {
      const req = request(f.app)[method](path);
      if (token !== undefined) req.set("Authorization", token);
      const response = await req.send({ KILL_SWITCH: true });
      expect(response.status).toBe(401);
      expect(response.headers["www-authenticate"]).toBe("Bearer");
      expect(response.text).not.toContain(ADMIN_TOKEN);
    }
    expect(f.storage.getConfig("KILL_SWITCH")).toBe(false);
    expect(f.hooks.onApproved).not.toHaveBeenCalled();
    expect(f.hooks.onHidden).not.toHaveBeenCalled();
  });

  it("mints, publishes, and hides through injected hooks without importing realtime", async () => {
    seed(f.storage);
    const approved = await request(f.app).post("/api/admin/artworks/art-1/mint").set("Authorization", auth);
    expect(approved.status).toBe(200);
    expect(approved.body.item).toMatchObject({ id: "art-1", status: "approved" });
    expect(f.hooks.onApproved).toHaveBeenCalledWith(approved.body.item);
    expect((await request(f.app).get("/api/gallery")).body.items).toHaveLength(1);
    const hidden = await request(f.app).post("/api/admin/artworks/art-1/hide").set("Authorization", auth);
    expect(hidden.status).toBe(200);
    expect(f.hooks.onHidden).toHaveBeenCalledWith("art-1");
    expect((await request(f.app).get("/api/gallery")).body.items).toEqual([]);
  });

  it("returns 404 for absent artwork without calling hooks", async () => {
    for (const action of ["mint", "hide"]) {
      expect((await request(f.app).post(`/api/admin/artworks/missing/${action}`).set("Authorization", auth)).status).toBe(404);
    }
    expect(f.hooks.onApproved).not.toHaveBeenCalled();
    expect(f.hooks.onHidden).not.toHaveBeenCalled();
  });

  it("validates configuration and makes no partial update on bad input", async () => {
    const good = await request(f.app).put("/api/admin/config").set("Authorization", auth)
      .send({ MODERATION_MODE: "mint_after_approve", KILL_SWITCH: true, IPFS_PROVIDER: "kubo" });
    expect(good.status).toBe(200);
    expect(good.body).toEqual({ MODERATION_MODE: "mint_after_approve", KILL_SWITCH: true, IPFS_PROVIDER: "kubo" });
    for (const body of [{ KILL_SWITCH: "false" }, { ADMIN_TOKEN: "secret" }, { KILL_SWITCH: false, IPFS_PROVIDER: "bad" }, []]) {
      expect((await request(f.app).put("/api/admin/config").set("Authorization", auth).send(body)).status).toBe(400);
    }
    expect(f.storage.getConfig()).toEqual(good.body);
  });

  it("requires exact confirmation for today's UTC date before archiving", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-08T00:00:00Z"));
    seed(f.storage, "art-1", "approved");
    f.storage.addVote({ artworkId: "art-1", category: "best", voterKey: "visitor" });
    for (const confirm of [undefined, "ARCHIVE 2026-10-07", "ARCHIVE 2026-10-09", " ARCHIVE 2026-10-08", "ARCHIVE 2026-10-08 ", "archive 2026-10-08"]) {
      const response = await request(f.app).post("/api/admin/reset").set("Authorization", auth).send({ confirm });
      expect(response.status).toBe(400);
      expect(f.storage.getById("art-1")).toBeDefined();
    }
    const reset = await request(f.app).post("/api/admin/reset").set("Authorization", auth).send({ confirm: "ARCHIVE 2026-10-08" });
    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject({ ok: true, artworkCount: 1, voteCount: 1, archiveId: expect.any(String) });
    expect(f.hooks.onHidden).toHaveBeenCalledWith("art-1");
    expect((await request(f.app).get("/api/gallery")).body.items).toEqual([]);
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM artworks").get()).toEqual({ n: 1 });
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM votes").get()).toEqual({ n: 1 });
    expect((await request(f.app).post("/api/admin/artworks/art-1/mint").set("Authorization", auth)).status).toBe(409);
  });

  it("catches rejected async hooks without exposing the failure details", async () => {
    seed(f.storage);
    f.hooks.onApproved.mockRejectedValue(new Error("SECRET_PROVIDER_CREDENTIAL"));
    const response = await request(f.app).post("/api/admin/artworks/art-1/mint").set("Authorization", auth);
    expect(response.status).toBe(500);
    expect(response.text).not.toContain("SECRET_PROVIDER_CREDENTIAL");
    expect(f.storage.getById("art-1")?.status).toBe("approved");
    f.hooks.onApproved.mockResolvedValue(undefined);
    expect((await request(f.app).post("/api/admin/artworks/art-1/mint").set("Authorization", auth)).status).toBe(200);
  });

  it("attempts all reset notifications when one hook fails, preserving the archive", async () => {
    seed(f.storage, "a", "approved"); seed(f.storage, "b", "approved");
    f.hooks.onHidden.mockImplementation((id: string) => { if (id === "a") throw new Error("SECRET"); });
    const confirm = `ARCHIVE ${new Date().toISOString().slice(0, 10)}`;
    const response = await request(f.app).post("/api/admin/reset").set("Authorization", auth).send({ confirm });
    expect(response.status).toBe(500);
    expect(response.text).not.toContain("SECRET");
    expect(f.hooks.onHidden).toHaveBeenCalledWith("a");
    expect(f.hooks.onHidden).toHaveBeenCalledWith("b");
    expect(f.storage.list().items).toEqual([]);
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM artworks").get()).toEqual({ n: 2 });
  });

  it("notifies the wall about every approved artwork when reset spans gallery pages", async () => {
    for (let index = 0; index < 101; index += 1) seed(f.storage, `art-${index}`, "approved");
    const confirm = `ARCHIVE ${new Date().toISOString().slice(0, 10)}`;
    const response = await request(f.app).post("/api/admin/reset").set("Authorization", auth).send({ confirm });
    expect(response.status).toBe(200);
    expect(response.body.artworkCount).toBe(101);
    expect(f.hooks.onHidden).toHaveBeenCalledTimes(101);
    expect(new Set(f.hooks.onHidden.mock.calls.map(([id]) => id)).size).toBe(101);
  });

  it("rejects unsafe empty auth configuration and accepts case-insensitive Bearer schemes", async () => {
    expect(() => adminAuth("")).toThrow(RangeError);
    expect(() => adminAuth("has whitespace")).toThrow(RangeError);
    seed(f.storage);
    expect((await request(f.app).post("/api/admin/artworks/art-1/mint").set("Authorization", `bearer ${ADMIN_TOKEN}`)).status).toBe(200);
  });
});

describe("votes and leaderboards", () => {
  it("accepts a vote, returns 409 for a duplicate triple, and aggregates publicly", async () => {
    seed(f.storage, "art-1", "approved");
    const vote = { artworkId: "art-1", category: "best", voterKey: "visitor-a" };
    expect((await request(f.app).post("/api/votes").send(vote)).status).toBe(201);
    const duplicate = await request(f.app).post("/api/votes").send(vote);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe("duplicate-vote");
    expect((await request(f.app).post("/api/votes").send({ ...vote, voterKey: "visitor-b" })).status).toBe(201);
    const response = await request(f.app).get("/api/leaderboard");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ artworkId: "art-1", category: "best", votes: 2 }]);
    expect(response.text).not.toContain("visitor-a");
  });

  it.each(["pending", "minted", "hidden", "failed"] as const)("rejects voting on %s artwork", async (status) => {
    seed(f.storage, "art-1", status);
    expect((await request(f.app).post("/api/votes").send({ artworkId: "art-1", category: "best", voterKey: "visitor" })).status).toBe(404);
  });

  it("validates vote fields and rejects unknown artwork", async () => {
    seed(f.storage, "art-1", "approved");
    for (const body of [{}, { artworkId: "art-1", category: "best" }, { artworkId: "art-1", category: [], voterKey: "x" }, []]) {
      expect((await request(f.app).post("/api/votes").send(body)).status).toBe(400);
    }
    expect((await request(f.app).post("/api/votes").send({ artworkId: "missing", category: "best", voterKey: "visitor" })).status).toBe(404);
  });

  it("excludes hidden and archived artwork from the public leaderboard", async () => {
    seed(f.storage, "art-1", "approved");
    f.storage.addVote({ artworkId: "art-1", category: "best", voterKey: "visitor" });
    f.storage.setStatus("art-1", "hidden");
    expect((await request(f.app).get("/api/leaderboard")).body).toEqual([]);
    f.storage.setStatus("art-1", "approved"); f.storage.archiveAll();
    expect((await request(f.app).get("/api/leaderboard")).body).toEqual([]);
    expect((await request(f.app).post("/api/votes").send({ artworkId: "art-1", category: "best", voterKey: "other" })).status).toBe(404);
  });
});
