/// <reference types="vitest/importMeta" />
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

// In-source tests keep this issue within its two-file ownership boundary.
// Vitest config: test.includeSource = ["src/middleware/rateLimit.ts", "src/routes/health.ts"].
// Test-only dependency: supertest (+ @types/supertest). Production does not load it.
if (import.meta.vitest) {
  const { describe, it, expect, vi, beforeEach, afterEach } = import.meta.vitest;
  const { default: express } = await import("express");
  const { default: request } = await import("supertest");
  const keyFn = (req: Request) => req.get("X-Test-Key") ?? "default";
  function appFor(perMinute = 2) {
    const app = express();
    app.get("/limited", createRateLimit({ perMinute, keyFn }), (_req, res) => res.sendStatus(204));
    return app;
  }
  beforeEach(() => {
    // Fake only the clock; Supertest's socket and timeout machinery stays real.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T00:00:00Z"));
  });
  afterEach(() => { vi.useRealTimers(); });

  describe("createRateLimit", () => {
    it("allows the threshold and returns 429 with Retry-After thereafter", async () => {
      const app = appFor();
      expect((await request(app).get("/limited")).status).toBe(204);
      expect((await request(app).get("/limited")).status).toBe(204);
      const blocked = await request(app).get("/limited");
      expect(blocked.status).toBe(429);
      expect(blocked.headers["retry-after"]).toBe("60");
      expect(blocked.body).toEqual({ code: "rate-limit", message: "Too many requests. Try again later." });
    });

    it("recovers exactly at the one-minute boundary", async () => {
      const app = appFor(1);
      await request(app).get("/limited");
      vi.advanceTimersByTime(59_999);
      const blocked = await request(app).get("/limited");
      expect(blocked.status).toBe(429);
      expect(blocked.headers["retry-after"]).toBe("1");
      vi.advanceTimersByTime(1);
      const recovered = await request(app).get("/limited");
      expect(recovered.status).toBe(204);
      expect(recovered.headers["retry-after"]).toBeUndefined();
      expect((await request(app).get("/limited")).status).toBe(429);
    });

    it("rounds Retry-After up to whole seconds", async () => {
      const app = appFor(1);
      await request(app).get("/limited");
      vi.advanceTimersByTime(1_001);
      expect((await request(app).get("/limited")).headers["retry-after"]).toBe("59");
    });

    it("does not extend a window when requests are rejected", async () => {
      const app = appFor(1);
      await request(app).get("/limited");
      vi.advanceTimersByTime(30_000);
      expect((await request(app).get("/limited")).status).toBe(429);
      vi.advanceTimersByTime(30_000);
      expect((await request(app).get("/limited")).status).toBe(204);
    });

    it("tracks distinct keys and their window start times independently", async () => {
      const app = appFor(1);
      await request(app).get("/limited").set("X-Test-Key", "a");
      vi.advanceTimersByTime(30_000);
      expect((await request(app).get("/limited").set("X-Test-Key", "b")).status).toBe(204);
      expect((await request(app).get("/limited").set("X-Test-Key", "a")).status).toBe(429);
      vi.advanceTimersByTime(30_000);
      expect((await request(app).get("/limited").set("X-Test-Key", "a")).status).toBe(204);
      const blocked = await request(app).get("/limited").set("X-Test-Key", "b");
      expect(blocked.status).toBe(429);
      expect(blocked.headers["retry-after"]).toBe("30");
    });

    it("keeps middleware instances independent", async () => {
      const first = appFor(1), second = appFor(1);
      await request(first).get("/limited");
      expect((await request(first).get("/limited")).status).toBe(429);
      expect((await request(second).get("/limited")).status).toBe(204);
    });

    it("handles concurrent requests without exceeding the allowance", async () => {
      const app = appFor(2);
      const responses = await Promise.all(Array.from({ length: 5 }, () => request(app).get("/limited")));
      expect(responses.filter((response) => response.status === 204)).toHaveLength(2);
      expect(responses.filter((response) => response.status === 429)).toHaveLength(3);
    });

    it("recovers after a long idle period", async () => {
      const app = appFor(1);
      await request(app).get("/limited");
      vi.advanceTimersByTime(10 * 60_000);
      expect((await request(app).get("/limited")).status).toBe(204);
    });

    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid perMinute %s", (perMinute) => {
      expect(() => createRateLimit({ perMinute, keyFn })).toThrow(RangeError);
    });
  });
}
