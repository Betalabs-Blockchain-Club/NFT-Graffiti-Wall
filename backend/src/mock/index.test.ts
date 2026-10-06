import { createHash } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { createMockApi } from "./index.js";

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const hash = createHash("sha256").update(pngBytes).digest("hex");
const openServers: HttpServer[] = [];

async function startMock(stageDelayMs = 10) {
  const api = createMockApi({ stageDelayMs, idFactory: () => "job-1" });
  const app = express();
  app.use(express.json());
  app.use(api.router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  openServers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not start");
  return { api, server, baseUrl: `http://127.0.0.1:${address.port}` };
}

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("B0 mock API", () => {
  it("runs a submitted PNG through all four stages", async () => {
    const { api, baseUrl } = await startMock();
    const form = new FormData();
    form.append("image", new Blob([pngBytes], { type: "image/png" }), "artwork.png");
    form.append("nickname", "Mock Artist");
    form.append("clientHash", hash);

    const submit = await fetch(`${baseUrl}/api/artworks`, {
      method: "POST",
      headers: { "X-Device-Id": "device-1" },
      body: form
    });
    expect(submit.status).toBe(202);
    expect(await submit.json()).toEqual({ jobId: "job-1", status: "pending" });

    await new Promise((resolve) => setTimeout(resolve, 55));
    const status = await fetch(`${baseUrl}/api/artworks/job-1/status`);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      jobId: "job-1",
      stage: "confirmed",
      tokenId: 1,
      imageCID: `bafy-mock-${hash.slice(0, 24)}`
    });
    api.close();
  });

  it("rejects a hash mismatch and protects non-approved gallery reads", async () => {
    const { api, baseUrl } = await startMock();
    const form = new FormData();
    form.append("image", new Blob([pngBytes], { type: "image/png" }), "artwork.png");
    form.append("nickname", "Mock Artist");
    form.append("clientHash", "0".repeat(64));

    const rejected = await fetch(`${baseUrl}/api/artworks`, { method: "POST", body: form });
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toMatchObject({ code: "hash-mismatch" });

    const pending = await fetch(`${baseUrl}/api/gallery?status=pending`);
    expect(pending.status).toBe(401);
    expect((await fetch(`${baseUrl}/api/gallery?status=approved`)).status).toBe(200);
    api.close();
  });

  it("enforces moderation, kill switch, and duplicate-vote behavior", async () => {
    const { api, baseUrl } = await startMock();
    const form = new FormData();
    form.append("image", new Blob([pngBytes], { type: "image/png" }), "artwork.png");
    form.append("nickname", "Mock Artist");
    form.append("clientHash", hash);
    await fetch(`${baseUrl}/api/artworks`, { method: "POST", body: form });
    await new Promise((resolve) => setTimeout(resolve, 55));

    const tokenHeaders = { Authorization: "Bearer mock-admin-token" };
    const approved = await fetch(`${baseUrl}/api/admin/artworks/job-1/approve`, {
      method: "POST",
      headers: tokenHeaders
    });
    expect(approved.status).toBe(200);
    expect((await (await fetch(`${baseUrl}/api/gallery?status=approved`)).json()).items).toHaveLength(1);

    const firstVote = await fetch(`${baseUrl}/api/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artworkId: "job-1", category: "best", voterKey: "device-1" })
    });
    const secondVote = await fetch(`${baseUrl}/api/votes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artworkId: "job-1", category: "best", voterKey: "device-1" })
    });
    expect(firstVote.status).toBe(201);
    expect(secondVote.status).toBe(409);

    await fetch(`${baseUrl}/api/admin/config`, {
      method: "PUT",
      headers: { ...tokenHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ KILL_SWITCH: true })
    });
    const blockedForm = new FormData();
    blockedForm.append("image", new Blob([pngBytes], { type: "image/png" }), "artwork.png");
    blockedForm.append("nickname", "Mock Artist");
    blockedForm.append("clientHash", hash);
    expect((await fetch(`${baseUrl}/api/artworks`, { method: "POST", body: blockedForm })).status).toBe(503);
    api.close();
  });

  it("emits subscribed job updates and gallery events", async () => {
    const { api, baseUrl } = await startMock();
    const namespaces = new Map<string, { handlers: Map<string, (socket: unknown) => void>; events: unknown[] }>();
    const io = {
      of(path: string) {
        const namespace = { handlers: new Map(), events: [] };
        namespaces.set(path, namespace);
        return {
          on(event: string, listener: (socket: unknown) => void) {
            namespace.handlers.set(event, listener);
          },
          emit(event: string, payload: unknown) {
            namespace.events.push({ event, payload });
          }
        };
      }
    };
    api.attachRealtime(io as never);

    const socketEvents: unknown[] = [];
    let subscribe: ((jobId: string) => void) | undefined;
    const socket = {
      emit: (_event: string, payload: unknown) => socketEvents.push(payload),
      on: (_event: string, listener: (jobId: string) => void) => {
        subscribe = listener;
      }
    };
    namespaces.get("/status")?.handlers.get("connection")?.(socket);
    subscribe?.("job-1");

    const form = new FormData();
    form.append("image", new Blob([pngBytes], { type: "image/png" }), "artwork.png");
    form.append("nickname", "Mock Artist");
    form.append("clientHash", hash);
    await fetch(`${baseUrl}/api/artworks`, { method: "POST", body: form });
    await new Promise((resolve) => setTimeout(resolve, 55));
    expect(socketEvents).toContainEqual(expect.objectContaining({ stage: "confirmed", jobId: "job-1" }));

    const approve = await fetch(`${baseUrl}/api/admin/artworks/job-1/approve`, {
      method: "POST",
      headers: { Authorization: "Bearer mock-admin-token" }
    });
    expect(approve.status).toBe(200);
    expect(namespaces.get("/gallery")?.events).toContainEqual(expect.objectContaining({ event: "new" }));
    api.close();
  });
});
