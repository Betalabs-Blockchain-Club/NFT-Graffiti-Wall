import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

/** Configure once with the secret token; never return it in a response. */
export function adminAuth(adminToken: string): RequestHandler {
  if (typeof adminToken !== "string" || !adminToken || /\s/.test(adminToken)) {
    throw new RangeError("A non-empty admin token without whitespace is required");
  }
  const expected = createHash("sha256").update(adminToken).digest();
  return (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get("Authorization") ?? "");
    if (!match || !timingSafeEqual(expected, createHash("sha256").update(match[1]).digest())) {
      res.setHeader("WWW-Authenticate", "Bearer");
      res.status(401).json({ code: "unauthorized", message: "Valid admin Bearer token required" });
      return;
    }
    next();
  };
}
