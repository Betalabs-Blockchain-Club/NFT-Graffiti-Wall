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

// In-source tests preserve this issue's single-file ownership boundary.
if (import.meta.vitest) {
  const { describe, it, expect, vi, afterEach } = import.meta.vitest;
  const { createHash } = await import("node:crypto");
  const cid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3pteyj2hudqjohfpnbshqrnu4";
  const cidV0 = "QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx";
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1sAAAAASUVORK5CYII=", "base64");
  const metadata = () => ({
    name: "Blockchain Art #7", description: "Created by Pixel Fox", image: `ipfs://${cid}`,
    attributes: [
      { trait_type: "Creator", value: "Pixel Fox" },
      { trait_type: "SHA-256", value: createHash("sha256").update(png).digest("hex") },
      { trait_type: "Event", value: "TechFest 2026" }
    ]
  });
  const pinataResponse = (value = cid) => Response.json({ IpfsHash: value });
  const kuboResponse = () => new Response(`${JSON.stringify({ Name: "artwork.png", Hash: cid, Size: "68" })}\n`);
  function mockFetch(implementation: typeof fetch = async () => pinataResponse()) { return vi.fn(implementation); }
  function api(fetchImpl: typeof fetch, provider: IpfsProvider = "pinata", overrides: Partial<IpfsOptions> = {}) {
    return createIpfs({ provider, pinataJwt: "test-jwt", kuboApi: "http://127.0.0.1:5001", gatewayUrl: "https://gateway.example/ipfs/", fetchImpl, ...overrides });
  }
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  describe("exact-byte pinning", () => {
    it("uploads the exact PNG bytes through Pinata without re-encoding", async () => {
      const fetchImpl = mockFetch();
      expect(await api(fetchImpl).pinImage(png)).toBe(cid);
      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe(`${PINATA_API}pinFileToIPFS`);
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("error");
      expect(init?.headers).toEqual({ Authorization: "Bearer test-jwt" });
      const form = init?.body as FormData;
      const file = form.get("file") as File;
      const sent = Buffer.from(await file.arrayBuffer());
      expect(sent).toEqual(png);
      expect(createHash("sha256").update(sent).digest("hex")).toBe(createHash("sha256").update(png).digest("hex"));
      expect(file.name).toBe("artwork.png");
      expect(file.type).toBe("image/png");
      expect(JSON.parse(form.get("pinataOptions") as string)).toEqual({ cidVersion: 1 });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it.each(["http://127.0.0.1:5001", "http://127.0.0.1:5001/api/v0/"])("pins through Kubo using base URL %s", async (kuboApi) => {
      const fetchImpl = mockFetch(async () => kuboResponse());
      expect(await api(fetchImpl, "kubo", { kuboApi }).pinImage(png)).toBe(cid);
      const [url, init] = fetchImpl.mock.calls[0];
      const parsed = new URL(String(url));
      expect(parsed.pathname).toBe("/api/v0/add");
      expect(Object.fromEntries(parsed.searchParams)).toEqual({ pin: "true", "cid-version": "1", "raw-leaves": "true", "wrap-with-directory": "false", progress: "false" });
      expect(init?.headers).toEqual({});
      expect(Buffer.from(await ((init?.body as FormData).get("file") as Blob).arrayBuffer())).toEqual(png);
    });

    it("pins the requested JSON object through Pinata", async () => {
      const fetchImpl = mockFetch();
      const content = metadata();
      expect(await api(fetchImpl).pinMetadata(content)).toBe(cid);
      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe(`${PINATA_API}pinJSONToIPFS`);
      expect(init?.headers).toEqual({ Authorization: "Bearer test-jwt", "Content-Type": "application/json" });
      expect(JSON.parse(init?.body as string)).toEqual({ pinataContent: content, pinataOptions: { cidVersion: 1 } });
    });

    it("pins UTF-8 JSON metadata as a Kubo file", async () => {
      const fetchImpl = mockFetch(async () => kuboResponse());
      const content = { ...metadata(), name: "Art 🎨", description: "नमस्ते" };
      expect(await api(fetchImpl, "kubo").pinMetadata(content)).toBe(cid);
      const file = (fetchImpl.mock.calls[0][1]?.body as FormData).get("file") as File;
      expect(file.name).toBe("metadata.json");
      expect(file.type).toBe("application/json");
      expect(await file.text()).toBe(JSON.stringify(content));
    });

    it("accepts provider CIDv0 responses", async () => {
      expect(await api(mockFetch(async () => pinataResponse(cidV0))).pinImage(png)).toBe(cidV0);
    });

    it("copies only a supplied Uint8Array view and preserves bytes during fallback", async () => {
      const source = Buffer.concat([Buffer.from("prefix"), png, Buffer.from("suffix")]);
      const view = new Uint8Array(source.buffer, source.byteOffset + 6, png.length);
      const sent: Buffer[] = [];
      const fetchImpl = mockFetch(async (_url, init) => {
        sent.push(Buffer.from(await ((init?.body as FormData).get("file") as Blob).arrayBuffer()));
        return sent.length === 1 ? new Response("failure", { status: 503 }) : kuboResponse();
      });
      const pinned = api(fetchImpl).pinImage(view);
      source.fill(0);
      expect(await pinned).toBe(cid);
      expect(sent).toEqual([png, png]);
    });
  });

  describe("fallback and retry classification", () => {
    it.each([
      { provider: "pinata" as const, operation: "pinImage" as const },
      { provider: "pinata" as const, operation: "pinMetadata" as const },
      { provider: "kubo" as const, operation: "pinImage" as const },
      { provider: "kubo" as const, operation: "pinMetadata" as const }
    ])("falls back after 5xx for $provider/$operation", async ({ provider, operation }) => {
      const fetchImpl = mockFetch().mockResolvedValueOnce(new Response("failure", { status: 503 }))
        .mockResolvedValueOnce(provider === "pinata" ? kuboResponse() : pinataResponse());
      const client = api(fetchImpl, provider);
      expect(await (operation === "pinImage" ? client.pinImage(png) : client.pinMetadata(metadata()))).toBe(cid);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      const fallback = fetchImpl.mock.calls[1][1];
      expect((fallback?.headers as Record<string, string>).Authorization).toBe(provider === "pinata" ? undefined : "Bearer test-jwt");
    });

    it("snapshots metadata before a failed primary attempt", async () => {
      const content = metadata(), original = JSON.stringify(content);
      const fetchImpl = mockFetch().mockResolvedValueOnce(new Response("failure", { status: 500 })).mockResolvedValueOnce(kuboResponse());
      const pinned = api(fetchImpl).pinMetadata(content);
      content.name = "Changed after submission";
      expect(await pinned).toBe(cid);
      const file = (fetchImpl.mock.calls[1][1]?.body as FormData).get("file") as Blob;
      expect(await file.text()).toBe(original);
    });

    it.each([408, 425, 429, 500, 503])("marks HTTP %s failures retryable", async (status) => {
      const error = await api(mockFetch(async () => new Response("SECRET", { status }))).pinImage(png).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(IpfsError);
      expect(error).toMatchObject({ retryable: true, code: "all-providers-failed" });
      expect(String(error)).not.toContain("SECRET");
    });

    it.each([400, 401, 403, 404, 413, 422])("marks permanent HTTP %s failures non-retryable", async (status) => {
      const error = await api(mockFetch(async () => new Response("failure", { status }))).pinImage(png).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(IpfsError);
      expect(error).toMatchObject({ retryable: false });
    });

    it("keeps retryable=true if one provider is transient and the other is permanent", async () => {
      const fetchImpl = mockFetch().mockResolvedValueOnce(new Response("failure", { status: 503 }))
        .mockResolvedValueOnce(new Response("failure", { status: 401 }));
      await expect(api(fetchImpl).pinImage(png)).rejects.toMatchObject({ retryable: true });
    });

    it("tries the alternate even after an authentication failure", async () => {
      const fetchImpl = mockFetch().mockResolvedValueOnce(new Response("failure", { status: 401 })).mockResolvedValueOnce(kuboResponse());
      expect(await api(fetchImpl).pinImage(png)).toBe(cid);
    });

    it("falls back on network errors without retaining raw secrets", async () => {
      const fetchImpl = mockFetch().mockRejectedValue(new Error("Bearer SECRET_JWT https://secret.invalid"));
      const error = await api(fetchImpl).pinImage(png).catch((error: unknown) => error);
      expect(error).toBeInstanceOf(IpfsError);
      expect(error).toMatchObject({ retryable: true });
      expect(JSON.stringify(error)).not.toContain("SECRET_JWT");
      expect(String(error)).not.toContain("secret.invalid");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("skips unconfigured providers without sending a request", async () => {
      const fetchImpl = mockFetch(async () => kuboResponse());
      expect(await api(fetchImpl, "pinata", { pinataJwt: undefined }).pinImage(png)).toBe(cid);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      fetchImpl.mockClear();
      await expect(api(fetchImpl, "pinata", { pinataJwt: undefined, kuboApi: undefined }).pinImage(png)).rejects.toMatchObject({ retryable: false });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each(["ftp://invalid", "http://user:password@localhost:5001", "invalid"])("falls back from invalid Kubo configuration (%s)", async (kuboApi) => {
      const fetchImpl = mockFetch();
      expect(await api(fetchImpl, "kubo", { kuboApi }).pinImage(png)).toBe(cid);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls[0][0]).toBe(`${PINATA_API}pinFileToIPFS`);
    });
  });

  describe("deadlines and response failures", () => {
    it("aborts a timed-out primary and falls back even when fetch ignores abort", async () => {
      vi.useFakeTimers();
      const fetchImpl = mockFetch().mockImplementationOnce(() => new Promise<Response>(() => {})).mockResolvedValueOnce(kuboResponse());
      const pinned = api(fetchImpl).pinImage(png);
      const signal = fetchImpl.mock.calls[0][1]?.signal;
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      expect(await pinned).toBe(cid);
      expect(signal?.aborted).toBe(true);
      expect(fetchImpl.mock.calls[1][1]?.signal?.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("applies the deadline while reading the response body", async () => {
      vi.useFakeTimers();
      const stalled = pinataResponse();
      vi.spyOn(stalled, "json").mockImplementation(() => new Promise(() => {}));
      const fetchImpl = mockFetch().mockResolvedValueOnce(stalled).mockResolvedValueOnce(kuboResponse());
      const pinned = api(fetchImpl).pinImage(png);
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      expect(await pinned).toBe(cid);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("bounds both failed attempts without an infinite fallback loop", async () => {
      vi.useFakeTimers();
      const fetchImpl = mockFetch(() => new Promise<Response>(() => {}));
      const outcome = api(fetchImpl).pinImage(png).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS * 2);
      expect(await outcome).toBeInstanceOf(IpfsError);
      expect(await outcome).toMatchObject({ retryable: true });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("clears deadlines immediately after success", async () => {
      vi.useFakeTimers();
      expect(await api(mockFetch()).pinImage(png)).toBe(cid);
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each([null, {}, { IpfsHash: "" }, { IpfsHash: "https://bad.example/" }, { IpfsHash: "ipfs://bad" }])("falls back on invalid Pinata success payload %j", async (payload) => {
      const fetchImpl = mockFetch().mockResolvedValueOnce(Response.json(payload)).mockResolvedValueOnce(kuboResponse());
      expect(await api(fetchImpl).pinImage(png)).toBe(cid);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("falls back on malformed JSON and handles Kubo newline-delimited output", async () => {
      const fetchImpl = mockFetch().mockResolvedValueOnce(new Response("not JSON"))
        .mockResolvedValueOnce(new Response(`${JSON.stringify({ Name: "artwork.png", Hash: cid })}\r\n\r\n`));
      expect(await api(fetchImpl).pinImage(png)).toBe(cid);
    });

    it("recognizes errors embedded in an HTTP 200 Kubo stream", async () => {
      const fetchImpl = mockFetch().mockResolvedValueOnce(new Response(`${JSON.stringify({ Hash: cid })}\n${JSON.stringify({ Message: "SECRET" })}\n`))
        .mockResolvedValueOnce(pinataResponse());
      expect(await api(fetchImpl, "kubo").pinImage(png)).toBe(cid);
    });
  });

  describe("permanent local input errors", () => {
    it("rejects invalid providers and unavailable fetch implementations", () => {
      expect(() => api(mockFetch(), "bad" as IpfsProvider)).toThrow(IpfsError);
      expect(() => api(mockFetch(), "pinata", { fetchImpl: null as never })).toThrow(IpfsError);
    });

    it("rejects empty images without contacting either provider", async () => {
      const fetchImpl = mockFetch();
      await expect(api(fetchImpl).pinImage(new Uint8Array())).rejects.toMatchObject({ retryable: false, code: "invalid-image" });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each(["name", "description", "image", "attributes"])("rejects metadata missing %s", async (field) => {
      const fetchImpl = mockFetch();
      const content: Record<string, unknown> = metadata(); delete content[field];
      await expect(api(fetchImpl).pinMetadata(content)).rejects.toMatchObject({ retryable: false, code: "invalid-metadata" });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each(["Creator", "SHA-256", "Event"])("rejects missing metadata trait %s", async (trait) => {
      const fetchImpl = mockFetch();
      const content = metadata(); content.attributes = content.attributes.filter((entry) => entry.trait_type !== trait);
      await expect(api(fetchImpl).pinMetadata(content)).rejects.toMatchObject({ retryable: false });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects invalid metadata image URIs, hashes, and unserializable data", async () => {
      const fetchImpl = mockFetch(), client = api(fetchImpl);
      await expect(client.pinMetadata({ ...metadata(), image: "https://gateway.example/image" })).rejects.toBeInstanceOf(IpfsError);
      const badHash = metadata(); badHash.attributes[1].value = "invalid";
      await expect(client.pinMetadata(badHash)).rejects.toBeInstanceOf(IpfsError);
      const cyclic: Record<string, unknown> = metadata(); cyclic.self = cyclic;
      await expect(client.pinMetadata(cyclic)).rejects.toMatchObject({ retryable: false });
      await expect(client.pinMetadata({ ...metadata(), extra: 1n })).rejects.toMatchObject({ retryable: false });
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
}
