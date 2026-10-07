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
