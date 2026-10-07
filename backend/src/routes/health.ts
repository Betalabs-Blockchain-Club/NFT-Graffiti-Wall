/// <reference types="vitest/importMeta" />
import { Router } from "express";

export interface HealthChecks {
  chain: () => Promise<boolean>;
  ipfs: () => Promise<boolean>;
  queueDepth: () => number;
  balanceEth: () => Promise<number>;
}

export interface HealthOptions {
  checks: HealthChecks;
}

async function checked<T>(check: () => T | Promise<T>, valid: (value: T) => boolean): Promise<T | false> {
  try {
    const value = await check();
    return valid(value) ? value : false;
  } catch {
    // Never expose provider error messages, URLs, credentials, or stack traces.
    return false;
  }
}

/** Mount with app.use(createHealthRouter({ checks })); W1 injects real checks. */
export function createHealthRouter({ checks }: HealthOptions): Router {
  const router = Router();
  router.get("/api/health", async (_req, res) => {
    const [chain, ipfs, queueDepth, balanceEth] = await Promise.all([
      checked(() => checks.chain(), (value) => value === true),
      checked(() => checks.ipfs(), (value) => value === true),
      checked(() => checks.queueDepth(), (value) => Number.isSafeInteger(value) && value >= 0),
      checked(() => checks.balanceEth(), (value) => Number.isFinite(value) && value >= 0)
    ]);
    res.json({
      ok: chain === true && ipfs === true && queueDepth !== false && balanceEth !== false,
      chain, ipfs, queueDepth, balanceEth
    });
  });
  return router;
}

// In-source tests: set test.includeSource to include this file and rateLimit.ts.
// Run with Vitest + Supertest; no real chain, IPFS, queue, or wallet is required.
if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;
  const { default: express } = await import("express");
  const { default: request } = await import("supertest");
  function healthy(): HealthChecks {
    return {
      chain: vi.fn(async () => true), ipfs: vi.fn(async () => true),
      queueDepth: vi.fn(() => 3), balanceEth: vi.fn(async () => 0.125)
    };
  }
  function appFor(checks: HealthChecks) {
    const app = express();
    app.use(createHealthRouter({ checks }));
    return app;
  }
  const expected = { ok: true, chain: true, ipfs: true, queueDepth: 3, balanceEth: 0.125 };

  describe("createHealthRouter", () => {
    it("exposes the exact health response using each injected check", async () => {
      const checks = healthy();
      const response = await request(appFor(checks)).get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expected);
      Object.values(checks).forEach((check) => expect(check).toHaveBeenCalledTimes(1));
    });

    it.each(["chain", "ipfs"] as const)("reports %s=false independently", async (name) => {
      const checks = healthy();
      checks[name] = async () => false;
      const response = await request(appFor(checks)).get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...expected, ok: false, [name]: false });
    });

    it.each(["chain", "ipfs", "queueDepth", "balanceEth"] as const)("isolates synchronous failures in %s and exposes no secrets", async (name) => {
      const checks = healthy();
      checks[name] = () => { throw new Error("private-key=TEST_SECRET_DO_NOT_EXPOSE"); };
      const response = await request(appFor(checks)).get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...expected, ok: false, [name]: false });
      expect(response.text).not.toContain("TEST_SECRET_DO_NOT_EXPOSE");
    });

    it.each(["chain", "ipfs", "balanceEth"] as const)("isolates rejected promises in %s", async (name) => {
      const checks = healthy();
      checks[name] = async () => { throw new Error("provider failure"); };
      const response = await request(appFor(checks)).get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...expected, ok: false, [name]: false });
    });

    it("handles all checks failing without crashing", async () => {
      const fail = () => { throw new Error("secret"); };
      const response = await request(appFor({ chain: fail, ipfs: fail, queueDepth: fail, balanceEth: fail })).get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: false, chain: false, ipfs: false, queueDepth: false, balanceEth: false });
    });

    it("accepts zero queue depth and zero balance", async () => {
      const response = await request(appFor({ ...healthy(), queueDepth: () => 0, balanceEth: async () => 0 })).get("/api/health");
      expect(response.body).toEqual({ ...expected, queueDepth: 0, balanceEth: 0 });
    });

    it.each([NaN, Infinity, -1])("reports invalid numeric readings %s as false", async (value) => {
      const response = await request(appFor({ ...healthy(), queueDepth: () => value, balanceEth: async () => value })).get("/api/health");
      expect(response.body).toEqual({ ...expected, ok: false, queueDepth: false, balanceEth: false });
    });

    it("rejects a fractional queue depth", async () => {
      const response = await request(appFor({ ...healthy(), queueDepth: () => 1.5 })).get("/api/health");
      expect(response.body).toEqual({ ...expected, ok: false, queueDepth: false });
    });

    it("starts checks independently rather than waiting for chain completion", async () => {
      let release!: (value: boolean) => void;
      const pending = new Promise<boolean>((resolve) => { release = resolve; });
      const checks = healthy();
      checks.chain = () => pending;
      checks.balanceEth = vi.fn(async () => { release(true); return 0.125; });
      const response = await request(appFor(checks)).get("/api/health");
      expect(response.body).toEqual(expected);
    });

    it("reruns checks on each request and recovers after a failed check", async () => {
      let available = false;
      const app = appFor({ ...healthy(), chain: async () => available });
      expect((await request(app).get("/api/health")).body).toEqual({ ...expected, ok: false, chain: false });
      available = true;
      expect((await request(app).get("/api/health")).body).toEqual(expected);
    });
  });
}
