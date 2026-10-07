/// <reference types="vitest/importMeta" />
export type IpfsProvider = "pinata" | "kubo";
export interface IpfsOptions {
  provider: IpfsProvider;
  pinataJwt?: string;
  kuboApi?: string;
  // Accepted for W1's configuration; writes go to provider APIs, not gateways.
  gatewayUrl: string;
  fetchImpl?: typeof fetch;
}

export class IpfsError extends Error {
  constructor(message: string, public readonly retryable: boolean,
    public readonly code = "ipfs-error", public readonly provider?: IpfsProvider,
    public readonly status?: number) {
    super(message);
    this.name = "IpfsError";
  }
}

const REQUEST_TIMEOUT_MS = 30_000;
const PINATA_API = "https://api.pinata.cloud/pinning/";

// Providers return CIDv0 base58btc or CIDv1 base32. Reject paths/URLs and empty
// success payloads before they can become token metadata or verification URLs.
function validCid(value: unknown): value is string {
  return typeof value === "string" && value.length <= 200
    && (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(value) || /^b[a-z2-7]{10,}$/.test(value));
}

function metadataJson(metadata: Record<string, unknown>): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)
    || typeof metadata.name !== "string" || !metadata.name.trim()
    || typeof metadata.description !== "string" || typeof metadata.image !== "string"
    || !metadata.image.startsWith("ipfs://") || !validCid(metadata.image.slice(7))
    || !Array.isArray(metadata.attributes)) {
    throw new IpfsError("Invalid artwork metadata", false, "invalid-metadata");
  }
  for (const trait of ["Creator", "SHA-256", "Event"]) {
    const attribute = metadata.attributes.find((entry) => entry && entry.trait_type === trait);
    if (!attribute || typeof attribute.value !== "string" || !attribute.value.trim()
      || (trait === "SHA-256" && !/^[a-f0-9]{64}$/i.test(attribute.value))) {
      throw new IpfsError("Required metadata attributes are invalid", false, "invalid-metadata");
    }
  }
  try {
    const json = JSON.stringify(metadata);
    if (typeof json !== "string") throw new Error();
    return json;
  } catch {
    throw new IpfsError("Metadata must be JSON serializable", false, "invalid-metadata");
  }
}

