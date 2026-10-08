import { createServer, type Server as HttpServer } from "node:http";
import { io, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import type { GalleryItem, MintJob } from "../../../shared/src/types/index.js";
import { createRealtime, type Realtime } from "./index.js";

const clients: Socket[] = [];
let realtime: Realtime | undefined;
let server: HttpServer | undefined;
const item: GalleryItem = {
  id: "art-1", nickname: "Pixel Fox", imageCID: "bafy-art", imageUrl: "ipfs://bafy-art",
  sha256: "a".repeat(64), status: "approved", createdAt: "2026-10-07T00:00:00.000Z"
};
const job = (jobId: string, stage: MintJob["stage"] = "minting"): MintJob => ({ jobId, stage });

function event<T>(socket: Socket, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, listener);
      reject(new Error(`Timed out waiting for ${name}`));
    }, 2000);
    const listener = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    socket.once(name, listener);
  });
}

async function start(allowedOrigin: string | string[] = "https://kiosk.example") {
  server = createServer();
  realtime = createRealtime(server, { allowedOrigin });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing server address");
  const base = `http://127.0.0.1:${address.port}`;
  async function connect(namespace: string, transport: "websocket" | "polling" = "websocket") {
    const client = io(`${base}${namespace}`, { transports: [transport], forceNew: true, reconnection: false, autoConnect: false });
    clients.push(client);
    const connected = event<void>(client, "connect");
    client.connect();
    await connected;
    return client;
  }
  return { base, connect, realtime };
}

// A received probe proves the subscription was processed, without relying on a
// fixed sleep or adding acknowledgement events to the frozen wire interface.
async function subscribe(client: Socket, id: string, emitter: Realtime) {
  const received = event<MintJob>(client, "job");
  client.emit("subscribe", id);
  const timer = setInterval(() => emitter.emitJob(id, job(id, "hashing")), 10);
  try { await received; } finally { clearInterval(timer); }
}

afterEach(async () => {
  clients.splice(0).forEach((client) => client.disconnect());
  await realtime?.close();
  realtime = undefined;
  server = undefined;
});

describe("gallery broadcasts", () => {
  it("sends exact new and hide payloads to every gallery client", async () => {
    const { connect, realtime } = await start();
    const gallery = await Promise.all([connect("/gallery"), connect("/gallery")]);
    const added = gallery.map((client) => event<GalleryItem>(client, "new"));
    realtime.emitNew(item);
    expect(await Promise.all(added)).toEqual([item, item]);
    const hidden = gallery.map((client) => event<{ id: string }>(client, "hide"));
    realtime.emitHide(item.id);
    expect(await Promise.all(hidden)).toEqual([{ id: item.id }, { id: item.id }]);
  });

  it("keeps gallery events out of the status namespace", async () => {
    const { connect, realtime } = await start();
    const gallery = await connect("/gallery");
    const status = await connect("/status");
    const unexpected: unknown[] = [];
    status.on("new", (value) => unexpected.push(value));
    status.on("hide", (value) => unexpected.push(value));
    const hidden = event(gallery, "hide");
    realtime.emitNew(item);
    realtime.emitHide(item.id);
    await hidden;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(unexpected).toEqual([]);
  });

  it.each(["pending", "minted", "hidden"] as const)("does not broadcast %s artwork to the public gallery", async (status) => {
    const { connect, realtime } = await start();
    const gallery = await connect("/gallery");
    const received: GalleryItem[] = [];
    gallery.on("new", (value) => received.push(value));
    const approved = event(gallery, "new");
    realtime.emitNew({ ...item, status });
    realtime.emitNew(item);
    await approved;
    expect(received).toEqual([item]);
  });

  it("delivers gallery events over polling transport", async () => {
    const { connect, realtime } = await start();
    const client = await connect("/gallery", "polling");
    const added = event(client, "new");
    realtime.emitNew(item);
    expect(await added).toEqual(item);
  });
});

describe("job room isolation", () => {
  it("sends no crosstalk between two kiosks subscribed to different jobs", async () => {
    const { connect, realtime } = await start();
    const [first, second, idle, gallery] = await Promise.all([
      connect("/status"), connect("/status"), connect("/status"), connect("/gallery")
    ]);
    await Promise.all([subscribe(first, "job-a", realtime), subscribe(second, "job-b", realtime)]);
    const firstJobs: MintJob[] = [], secondJobs: MintJob[] = [], unexpected: MintJob[] = [];
    first.on("job", (value) => firstJobs.push(value));
    second.on("job", (value) => secondJobs.push(value));
    idle.on("job", (value) => unexpected.push(value));
    gallery.on("job", (value) => unexpected.push(value));
    const firstDone = event(first, "job"), secondDone = event(second, "job");
    realtime.emitJob("job-a", job("job-a", "confirmed"));
    realtime.emitJob("job-b", job("job-b", "failed"));
    await Promise.all([firstDone, secondDone]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(firstJobs).toEqual([job("job-a", "confirmed")]);
    expect(secondJobs).toEqual([job("job-b", "failed")]);
    expect(unexpected).toEqual([]);
  });

  it("supports multiple subscribers to the same job", async () => {
    const { connect, realtime } = await start();
    const clients = await Promise.all([connect("/status"), connect("/status")]);
    await Promise.all(clients.map((client) => subscribe(client, "shared-job", realtime)));
    const received = clients.map((client) => event(client, "job"));
    const payload = { ...job("shared-job", "confirmed"), tokenId: 42, txHash: "0xabc", imageCID: "bafy-art" };
    realtime.emitJob("shared-job", payload);
    expect(await Promise.all(received)).toEqual([payload, payload]);
  });

  it("makes repeated subscriptions idempotent", async () => {
    const { connect, realtime } = await start();
    const client = await connect("/status");
    await subscribe(client, "job-a", realtime);
    await subscribe(client, "job-a", realtime);
    const received: MintJob[] = [];
    client.on("job", (value) => received.push(value));
    const done = event(client, "job");
    realtime.emitJob("job-a", job("job-a"));
    await done;
    expect(received).toEqual([job("job-a")]);
  });

  it("ignores malformed subscriptions and still handles a valid subscription", async () => {
    const { connect, realtime } = await start();
    const client = await connect("/status");
    for (const value of [null, {}, [], 5, "", "   "]) client.emit("subscribe", value);
    await subscribe(client, "valid-job", realtime);
    const received: MintJob[] = [];
    client.on("job", (value) => received.push(value));
    const done = event(client, "job");
    realtime.emitJob("", job(""));
    realtime.emitJob("   ", job("   "));
    realtime.emitJob("valid-job", job("valid-job"));
    await done;
    expect(received).toEqual([job("valid-job")]);
  });

  it("does not leak a job payload through a mismatched routing id", async () => {
    const { connect, realtime } = await start();
    const client = await connect("/status");
    await subscribe(client, "job-a", realtime);
    const received: MintJob[] = [];
    client.on("job", (value) => received.push(value));
    const done = event(client, "job");
    realtime.emitJob("job-a", job("job-b"));
    realtime.emitJob("job-a", job("job-a"));
    await done;
    expect(received).toEqual([job("job-a")]);
  });

  it("does not cache updates for replay to late subscribers", async () => {
    const { connect, realtime } = await start();
    realtime.emitJob("job-a", job("job-a", "confirmed"));
    const client = await connect("/status");
    const received: MintJob[] = [];
    client.on("job", (value) => received.push(value));
    await subscribe(client, "job-a", realtime);
    expect(received.every((value) => value.stage === "hashing")).toBe(true);
  });

  it("requires a fresh subscription after reconnect", async () => {
    const { connect, realtime } = await start();
    const old = await connect("/status");
    await subscribe(old, "job-a", realtime);
    old.disconnect();
    const fresh = await connect("/status");
    const received: MintJob[] = [];
    fresh.on("job", (value) => received.push(value));
    realtime.emitJob("job-a", job("job-a", "confirmed"));
    await subscribe(fresh, "job-a", realtime);
    expect(received.every((value) => value.stage === "hashing")).toBe(true);
  });
});

describe("configuration and shutdown", () => {
  it.each(["https://kiosk.example", ["https://kiosk.example", "https://gallery.example"]])("sets the configured polling CORS origin (%j)", async (allowedOrigin) => {
    const { base } = await start(allowedOrigin);
    const response = await fetch(`${base}/socket.io/?EIO=4&transport=polling`, { headers: { Origin: "https://kiosk.example" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://kiosk.example");
    await response.text();
  });

  it("disconnects both namespaces and shares repeated close completion", async () => {
    const { connect, realtime } = await start();
    const clients = await Promise.all([connect("/gallery"), connect("/status")]);
    const disconnected = clients.map((client) => event(client, "disconnect"));
    const firstClose = realtime.close();
    expect(realtime.close()).toBe(firstClose);
    await Promise.all([firstClose, ...disconnected]);
    expect(clients.every((client) => !client.connected)).toBe(true);
    expect(server?.listening).toBe(false);
  });
});
