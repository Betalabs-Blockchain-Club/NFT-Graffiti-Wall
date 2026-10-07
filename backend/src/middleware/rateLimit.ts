import type { Request, RequestHandler } from "express";

export interface RateLimitOptions {
  perMinute: number;
  keyFn: (req: Request) => string;
}

const WINDOW_MS = 60_000;

/** Per-key fixed windows, beginning with the first request. Process-local only. */
export function createRateLimit({ perMinute, keyFn }: RateLimitOptions): RequestHandler {
  if (!Number.isSafeInteger(perMinute) || perMinute < 1) {
    throw new RangeError("perMinute must be a positive safe integer");
  }
  const windows = new Map<string, { count: number; resetAt: number }>();
  let nextSweep = 0;

  return (req, res, next) => {
    const now = Date.now();
    // Prune expired keys lazily, with no background timer keeping Node alive.
    if (now >= nextSweep) {
      for (const [key, window] of windows) {
        if (now >= window.resetAt) windows.delete(key);
      }
      nextSweep = now + WINDOW_MS;
    }
    const key = keyFn(req);
    let window = windows.get(key);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + WINDOW_MS };
      windows.set(key, window);
    }
    if (window.count >= perMinute) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((window.resetAt - now) / 1000))));
      res.status(429).json({ code: "rate-limit", message: "Too many requests. Try again later." });
      return;
    }
    window.count += 1;
    next();
  };
}
