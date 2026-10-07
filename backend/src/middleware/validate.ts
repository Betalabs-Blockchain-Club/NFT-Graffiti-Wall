import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import multer from "multer";
import { validateNickname } from "../utils/nickname.js";

export interface ValidatedUpload {
  bytes: Buffer;
  sha256: string;
  nickname: string;
}

declare global {
  namespace Express {
    interface Request {
      upload?: ValidatedUpload;
    }
  }
}

export type UploadValidationResult =
  | { ok: true; sha256: string; nickname: string }
  | { ok: false; status: 400 | 413; code: string; message: string };

interface UploadInput {
  bytes: Uint8Array;
  clientHash: unknown;
  nickname: unknown;
  maxKb: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function sizeLimit(maxKb: number): number {
  const bytes = maxKb * 1024;
  if (!Number.isSafeInteger(bytes) || bytes < 1) {
    throw new RangeError("maxKb must specify a positive, safe integer number of bytes");
  }
  return bytes;
}

function failure(status: 400 | 413, code: string, message: string): UploadValidationResult & { ok: false } {
  return { ok: false, status, code, message };
}

/** Validate the exact received bytes without decoding or re-encoding the image. */
export function validateUpload({ bytes, clientHash, nickname, maxKb }: UploadInput): UploadValidationResult {
  if (bytes.byteLength > sizeLimit(maxKb)) {
    return failure(413, "oversize", `Image must be at most ${maxKb} KB`);
  }
  if (bytes.byteLength < PNG_SIGNATURE.length || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return failure(400, "invalid-png", "Image must have a PNG signature");
  }
  if (typeof nickname !== "string") {
    return failure(400, "invalid-nickname", "Nickname must be 1-32 characters");
  }
  const checkedNickname = validateNickname(nickname);
  if (!checkedNickname.ok) {
    return failure(400, "invalid-nickname", checkedNickname.reason === "profanity"
      ? "Nickname contains blocked language"
      : "Nickname must be 1-32 characters");
  }
  if (typeof clientHash !== "string" || !/^[a-fA-F0-9]{64}$/.test(clientHash)) {
    return failure(400, "invalid-hash", "clientHash must be a 64-character hexadecimal SHA-256 hash");
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== clientHash.toLowerCase()) {
    return failure(400, "hash-mismatch", "clientHash does not match the received image bytes");
  }
  return { ok: true, sha256, nickname: checkedNickname.value };
}

/** Multipart fields: image (one file), nickname, clientHash. */
export function createUploadMiddleware({ maxKb }: { maxKb: number }): RequestHandler {
  const parse = multer({
    storage: multer.memoryStorage(),
    // Busboy signals its file limit at equality. Allow one extra byte here so
    // validateUpload can enforce the inclusive limit on the received buffer.
    limits: { fileSize: sizeLimit(maxKb) + 1, files: 1, fields: 2, fieldSize: 1024, fieldNameSize: 100 }
  }).single("image");

  return (req, res, next) => {
    delete req.upload;
    parse(req, res, (error: unknown) => {
      if (error) {
        const oversize = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
        res.status(oversize ? 413 : 400).json({
          code: oversize ? "oversize" : "invalid-upload",
          message: oversize ? `Image must be at most ${maxKb} KB` : "Invalid multipart upload"
        });
        return;
      }
      if (!req.file) {
        res.status(400).json({ code: "missing-image", message: "Multipart image file is required" });
        return;
      }
      const result = validateUpload({
        bytes: req.file.buffer,
        clientHash: req.body?.clientHash,
        nickname: req.body?.nickname,
        maxKb
      });
      if (!result.ok) {
        res.status(result.status).json({ code: result.code, message: result.message });
        return;
      }
      req.upload = { bytes: req.file.buffer, sha256: result.sha256, nickname: result.nickname };
      next();
    });
  };
}
