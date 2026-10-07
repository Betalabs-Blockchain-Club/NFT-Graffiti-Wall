import { createHash } from "node:crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createUploadMiddleware, validateUpload } from "../middleware/validate.js";

// Real 1x1 PNG; tests hash the original file bytes, including all PNG chunks.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1sAAAAASUVORK5CYII=", "base64");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const valid = { bytes: png, nickname: "  Pixel Fox  ", clientHash: hash(png), maxKb: 1 };
const cases = [
  { name: "hash mismatch", input: { clientHash: "0".repeat(64) }, status: 400, code: "hash-mismatch" },
  { name: "oversize", input: { bytes: Buffer.concat([png, Buffer.alloc(1024)]) }, status: 413, code: "oversize" },
  { name: "non-PNG", input: { bytes: Buffer.from("not a PNG") }, status: 400, code: "invalid-png" },
  { name: "empty image", input: { bytes: Buffer.alloc(0) }, status: 400, code: "invalid-png" },
  { name: "partial signature", input: { bytes: png.subarray(0, 7) }, status: 400, code: "invalid-png" },
  { name: "corrupt signature", input: { bytes: Buffer.concat([Buffer.from([0]), png.subarray(1)]) }, status: 400, code: "invalid-png" },
  { name: "empty nickname", input: { nickname: "" }, status: 400, code: "invalid-nickname" },
  { name: "blank nickname", input: { nickname: " \t\n " }, status: 400, code: "invalid-nickname" },
  { name: "long nickname", input: { nickname: "a".repeat(33) }, status: 400, code: "invalid-nickname" },
  { name: "blocked nickname", input: { nickname: "ShIt" }, status: 400, code: "invalid-nickname" },
  { name: "normalized profanity", input: { nickname: "ｓｈｉｔ" }, status: 400, code: "invalid-nickname" },
  { name: "malformed hash", input: { clientHash: "z".repeat(64) }, status: 400, code: "invalid-hash" },
  { name: "short hash", input: { clientHash: "abc" }, status: 400, code: "invalid-hash" }
] as const;

describe("validateUpload", () => {
  it("returns the recomputed hash and trimmed nickname without changing bytes", () => {
    const original = Buffer.from(png);
    expect(validateUpload(valid)).toEqual({ ok: true, sha256: hash(png), nickname: "Pixel Fox" });
    expect(png).toEqual(original);
  });

  it.each(cases)("rejects $name", ({ input, status, code }) => {
    expect(validateUpload({ ...valid, ...input })).toMatchObject({ ok: false, status, code, message: expect.any(String) });
  });

  it("hashes exactly a Uint8Array view rather than its entire backing buffer", () => {
    const backing = Buffer.concat([Buffer.from("prefix"), png, Buffer.from("suffix")]);
    const bytes = new Uint8Array(backing.buffer, backing.byteOffset + 6, png.length);
    expect(validateUpload({ ...valid, bytes })).toMatchObject({ ok: true, sha256: hash(png) });
  });

  it("accepts the size boundary, 32 Unicode characters, and uppercase hex", () => {
    const bytes = Buffer.concat([png, Buffer.alloc(1024 - png.length)]);
    expect(validateUpload({ ...valid, bytes, nickname: "🎨".repeat(32), clientHash: hash(bytes).toUpperCase() }))
      .toEqual({ ok: true, sha256: hash(bytes), nickname: "🎨".repeat(32) });
  });

  it.each([undefined, null, [], {}])("rejects non-string fields (%j)", (value) => {
    expect(validateUpload({ ...valid, nickname: value })).toMatchObject({ ok: false, code: "invalid-nickname" });
    expect(validateUpload({ ...valid, clientHash: value })).toMatchObject({ ok: false, code: "invalid-hash" });
  });

  it.each([0, -1, NaN, Infinity])("rejects invalid configured size %s", (maxKb) => {
    expect(() => validateUpload({ ...valid, maxKb })).toThrow(RangeError);
    expect(() => createUploadMiddleware({ maxKb })).toThrow(RangeError);
  });
});

function testApp() {
  const app = express();
  const received: express.Request[] = [];
  app.post("/upload", createUploadMiddleware({ maxKb: 1 }), (req, res) => {
    received.push(req);
    res.status(202).json({ sha256: req.upload?.sha256, nickname: req.upload?.nickname });
  });
  return { app, received };
}

describe("createUploadMiddleware", () => {
  it("attaches the unchanged multer buffer and recomputed hash before calling next", async () => {
    const { app, received } = testApp();
    const response = await request(app).post("/upload")
      .field("nickname", valid.nickname).field("clientHash", valid.clientHash)
      .attach("image", png, { filename: "drawing.png", contentType: "image/png" });
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ sha256: hash(png), nickname: "Pixel Fox" });
    expect(received[0].upload?.bytes).toBe(received[0].file?.buffer);
    expect(received[0].upload?.bytes).toEqual(png);
  });

  it.each(cases)("rejects $name without reaching the route", async ({ input, status, code }) => {
    const { app, received } = testApp();
    const data = { ...valid, ...input };
    const response = await request(app).post("/upload")
      .attach("image", data.bytes, { filename: "drawing.png", contentType: "image/png" })
      .field("nickname", data.nickname).field("clientHash", data.clientHash);
    expect(response.status).toBe(status);
    expect(response.body).toMatchObject({ code, message: expect.any(String) });
    expect(received).toHaveLength(0);
  });

  it("accepts a file exactly at the size limit regardless of MIME label", async () => {
    const { app } = testApp();
    const bytes = Buffer.concat([png, Buffer.alloc(1024 - png.length)]);
    const response = await request(app).post("/upload")
      .field("nickname", "Artist").field("clientHash", hash(bytes))
      .attach("image", bytes, { filename: "drawing.bin", contentType: "application/octet-stream" });
    expect(response.status).toBe(202);
    expect(response.body.sha256).toBe(hash(bytes));
  });

  it("rejects missing images and JSON requests", async () => {
    const { app, received } = testApp();
    for (const response of [
      await request(app).post("/upload").field("nickname", "Artist").field("clientHash", hash(png)),
      await request(app).post("/upload").send({ nickname: "Artist", clientHash: hash(png) })
    ]) {
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("missing-image");
    }
    expect(received).toHaveLength(0);
  });

  it.each(["nickname", "clientHash"] as const)("rejects missing or duplicate %s", async (field) => {
    const { app, received } = testApp();
    const other = field === "nickname" ? "clientHash" : "nickname";
    const values = { nickname: "Artist", clientHash: hash(png) };
    const missing = await request(app).post("/upload").field(other, values[other]).attach("image", png, "drawing.png");
    expect(missing.status).toBe(400);
    const duplicate = await request(app).post("/upload")
      .field(field, values[field]).field(field, values[field]).attach("image", png, "drawing.png");
    expect(duplicate.status).toBe(400);
    expect(received).toHaveLength(0);
  });

  it("rejects extra files and malformed multipart bodies", async () => {
    const { app, received } = testApp();
    const extra = await request(app).post("/upload").attach("other", png, "drawing.png");
    expect(extra.status).toBe(400);
    expect(extra.body.code).toBe("invalid-upload");
    const malformed = await request(app).post("/upload").set("Content-Type", "multipart/form-data").send("broken");
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe("invalid-upload");
    expect(received).toHaveLength(0);
  });
});
