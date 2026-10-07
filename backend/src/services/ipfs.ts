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

/** Pin exact received bytes and metadata; all configuration is caller supplied. */
export function createIpfs({ provider, pinataJwt, kuboApi, fetchImpl = globalThis.fetch }: IpfsOptions) {
  if (provider !== "pinata" && provider !== "kubo") {
    throw new IpfsError("Unsupported IPFS provider", false, "invalid-config");
  }
  if (typeof fetchImpl !== "function") throw new IpfsError("Fetch implementation is required", false, "invalid-config");

  async function request(target: IpfsProvider, file: Blob, filename: string, json?: string): Promise<string> {
    let url: string;
    const headers: Record<string, string> = {};
    let body: BodyInit;
    if (target === "pinata") {
      if (typeof pinataJwt !== "string" || !pinataJwt.trim() || /\s/.test(pinataJwt)) {
        throw new IpfsError("Pinata credentials are not configured", false, "invalid-config", target);
      }
      headers.Authorization = `Bearer ${pinataJwt}`;
      if (json !== undefined) {
        url = `${PINATA_API}pinJSONToIPFS`;
        headers["Content-Type"] = "application/json";
        body = `{"pinataContent":${json},"pinataOptions":{"cidVersion":1}}`;
      } else {
        url = `${PINATA_API}pinFileToIPFS`;
        const form = new FormData();
        form.append("file", file, filename);
        form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
        body = form;
      }
    } else {
      try {
        const base = new URL(kuboApi ?? "");
        if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error();
        base.pathname = `${base.pathname.replace(/\/$/, "").replace(/\/api\/v0$/, "")}/api/v0/add`;
        base.search = new URLSearchParams({ pin: "true", "cid-version": "1", "raw-leaves": "true",
          "wrap-with-directory": "false", progress: "false" }).toString();
        url = base.toString();
      } catch {
        throw new IpfsError("Kubo API URL is not configured correctly", false, "invalid-config", target);
      }
      const form = new FormData();
      form.append("file", file, filename);
      body = form;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new IpfsError("IPFS request timed out", true, "timeout", target));
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    });
    const perform = async () => {
      const response = await fetchImpl(url, { method: "POST", headers, body, signal: controller.signal, redirect: "error" });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        const retryable = response.status >= 500 || [408, 425, 429].includes(response.status);
        throw new IpfsError("IPFS provider rejected the request", retryable, "http-error", target, response.status);
      }
      try {
        let cid: unknown;
        if (target === "pinata") {
          const payload = await response.json() as { IpfsHash?: unknown } | null;
          cid = payload?.IpfsHash;
        } else {
          const lines = (await response.text()).trim().split(/\r?\n/).filter(Boolean);
          const records = lines.map((line) => JSON.parse(line) as { Hash?: unknown; Message?: unknown; Error?: unknown });
          if (records.some((record) => !record || record.Message !== undefined || record.Error !== undefined)) throw new Error();
          cid = records.at(-1)?.Hash;
        }
        if (!validCid(cid)) throw new Error();
        return cid;
      } catch {
        throw new IpfsError("IPFS provider returned an invalid response", true, "invalid-response", target);
      }
    };
    try {
      return await Promise.race([perform(), timeout]);
    } catch (error) {
      if (error instanceof IpfsError) throw error;
      // Provider bodies and raw network exceptions can contain credentials.
      throw new IpfsError("IPFS provider is unreachable", true, "network-error", target);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async function pin(file: Blob, filename: string, json?: string): Promise<string> {
    const failures: IpfsError[] = [];
    for (const target of [provider, provider === "pinata" ? "kubo" : "pinata"] as const) {
      try { return await request(target, file, filename, json); }
      catch (error) { failures.push(error as IpfsError); }
    }
    throw new IpfsError("IPFS pinning failed for both providers", failures.some((error) => error.retryable), "all-providers-failed");
  }

  return {
    async pinImage(bytes: Uint8Array): Promise<string> {
      if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
        throw new IpfsError("Image bytes are required", false, "invalid-image");
      }
      // Copy precisely this view once, before any await. Blob snapshots those
      // bytes for both attempts even if the caller mutates its buffer later.
      const file = new Blob([new Uint8Array(bytes)], { type: "image/png" });
      return pin(file, "artwork.png");
    },
    async pinMetadata(metadata: Record<string, unknown>): Promise<string> {
      const json = metadataJson(metadata);
      return pin(new Blob([json], { type: "application/json" }), "metadata.json", json);
    }
  };
}
