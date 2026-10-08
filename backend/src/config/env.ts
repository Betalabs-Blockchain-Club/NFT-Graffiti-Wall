import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: resolve(repoRoot, ".env") });

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CHAIN_NETWORK: z.enum(["polygon-amoy", "sepolia", "localhost"]).default("polygon-amoy"),
  RPC_URL: z.string().url(),
  CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  MINTER_PRIVATE_KEY: z.string().regex(/^(0x)?[a-fA-F0-9]{64}$/),
  IPFS_PROVIDER: z.enum(["pinata", "kubo"]).default("pinata"),
  PINATA_JWT: z.string().optional(),
  KUBO_API: z.string().url().default("http://localhost:5001"),
  IPFS_GATEWAY: z.string().url().default("https://gateway.pinata.cloud/ipfs/"),
  DATABASE_URL: z.string().default("file:./data.db"),
  MODERATION_MODE: z.enum(["display_after_approve", "mint_after_approve"]).default("display_after_approve"),
  MAX_IMAGE_KB: z.coerce.number().int().positive().default(500),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(5),
  KILL_SWITCH: z.string().default("false").transform((value, ctx) => {
    if (value !== "true" && value !== "false") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be true or false" });
      return z.NEVER;
    }
    return value === "true";
  }),
  ADMIN_TOKEN: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://localhost:5174,http://localhost:5175")
}).superRefine((value, ctx) => {
  if (value.IPFS_PROVIDER === "pinata" && !value.PINATA_JWT?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["PINATA_JWT"], message: "required when IPFS_PROVIDER=pinata" });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map(({ path, message }) => `${path.join(".") || "environment"}: ${message}`).join("; ");
  throw new Error(`Invalid backend configuration (${details})`);
}

export const env = {
  ...parsed.data,
  expectedChainId: ({ "polygon-amoy": 80002, sepolia: 11155111, localhost: 31337 } as const)[parsed.data.CHAIN_NETWORK],
  corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
  databasePath: parsed.data.DATABASE_URL === ":memory:" ? ":memory:"
    : resolve(repoRoot, parsed.data.DATABASE_URL.startsWith("file:")
      ? parsed.data.DATABASE_URL.slice("file:".length) : parsed.data.DATABASE_URL)
};
