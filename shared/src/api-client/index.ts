import { z } from "zod";
import type { GalleryItem, MintJob } from "../types/index.js";

const JobStageSchema = z.enum(["hashing", "uploading", "minting", "confirmed", "failed"]);
const ArtworkStatusSchema = z.enum(["pending", "minted", "approved", "hidden", "failed"]);
const GalleryStatusSchema = z.enum(["pending", "minted", "approved", "hidden"]);

const SubmitArtworkResponseSchema = z.object({
  jobId: z.string(),
  status: ArtworkStatusSchema
});

const MintJobSchema = z.object({
  jobId: z.string(),
  stage: JobStageSchema,
  tokenId: z.number().optional(),
  txHash: z.string().optional(),
  imageCID: z.string().optional(),
  metadataCID: z.string().optional(),
  retry: z.number().optional(),
  error: z.string().optional()
});

const GalleryItemSchema = z.object({
  id: z.string(),
  tokenId: z.number().optional(),
  nickname: z.string(),
  imageCID: z.string(),
  imageUrl: z.string(),
  sha256: z.string(),
  status: GalleryStatusSchema,
  createdAt: z.string()
});

const GalleryResponseSchema = z.object({
  items: z.array(GalleryItemSchema),
  nextCursor: z.string().nullable().optional()
});

const HealthSchema = z.object({
  ok: z.boolean(),
  chain: z.union([z.boolean(), z.string()]),
  ipfs: z.union([z.boolean(), z.string()]),
  queueDepth: z.number(),
  balanceEth: z.number()
});

const LeaderboardSchema = z.array(
  z.object({
    artworkId: z.string(),
    category: z.string(),
    votes: z.number()
  })
);

const ActionResponseSchema: z.ZodType<GalleryItem | undefined, z.ZodTypeDef, unknown> = z
  .union([
    GalleryItemSchema,
    z.object({ item: GalleryItemSchema }),
    z.object({ ok: z.boolean() })
  ])
  .transform((response): GalleryItem | undefined => {
    if ("item" in response) {
      return response.item;
    }

    if ("ok" in response) {
      return undefined;
    }

    return response;
  });

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ApiClientOptions = {
  baseUrl: string;
  adminToken?: string;
  fetchImpl?: FetchImpl;
};

export type SubmitArtworkResponse = z.infer<typeof SubmitArtworkResponseSchema>;
export type HealthResponse = z.infer<typeof HealthSchema>;
export type LeaderboardEntry = z.infer<typeof LeaderboardSchema>[number];
export type GalleryQuery = {
  status?: z.infer<typeof GalleryStatusSchema>;
  limit?: number;
  cursor?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({ baseUrl, adminToken, fetchImpl = fetch }: ApiClientOptions) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  function url(path: string): string {
    return `${normalizedBaseUrl}${path}`;
  }

  function authHeaders(required: boolean): Record<string, string> {
    if (required && !adminToken) {
      throw new ApiError(401, "missing_admin_token", "This request requires an admin token");
    }

    return adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
  }

  async function request<T>(
    path: string,
    schema: z.ZodType<T, z.ZodTypeDef, any>,
    init: RequestInit = {}
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetchImpl(url(path), init);
    } catch (error) {
      throw new ApiError(0, "network_error", "The API request could not be completed", error);
    }

    const bodyText = await response.text();
    let body: unknown;

    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = bodyText;
      }
    }

    if (!response.ok) {
      const errorBody = body && typeof body === "object" ? body as Record<string, unknown> : {};
      throw new ApiError(
        response.status,
        typeof errorBody.code === "string" ? errorBody.code : `http_${response.status}`,
        typeof errorBody.message === "string" ? errorBody.message : response.statusText,
        body
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(502, "invalid_response", "The API returned an invalid response", parsed.error);
    }

    return parsed.data;
  }

  return {
    submitArtwork(blob: Blob, nickname: string, clientHash: string, deviceId: string) {
      const form = new FormData();
      form.append("image", blob, "artwork.png");
      form.append("nickname", nickname);
      form.append("clientHash", clientHash);

      return request("/api/artworks", SubmitArtworkResponseSchema, {
        method: "POST",
        headers: { "X-Device-Id": deviceId },
        body: form
      });
    },

    getStatus(jobId: string): Promise<MintJob> {
      return request(`/api/artworks/${encodeURIComponent(jobId)}/status`, MintJobSchema);
    },

    getGallery({ status = "approved", limit, cursor }: GalleryQuery = {}) {
      const query = new URLSearchParams({ status });
      if (limit !== undefined) query.set("limit", String(limit));
      if (cursor !== undefined) query.set("cursor", cursor);

      return request(`/api/gallery?${query}`, GalleryResponseSchema, {
        headers: authHeaders(status !== "approved")
      });
    },

    approve(id: string): Promise<GalleryItem | undefined> {
      return request(`/api/admin/artworks/${encodeURIComponent(id)}/approve`, ActionResponseSchema, {
        method: "POST",
        headers: authHeaders(true)
      });
    },

    hide(id: string): Promise<GalleryItem | undefined> {
      return request(`/api/admin/artworks/${encodeURIComponent(id)}/hide`, ActionResponseSchema, {
        method: "POST",
        headers: authHeaders(true)
      });
    },

    health(): Promise<HealthResponse> {
      return request("/api/health", HealthSchema, { headers: authHeaders(true) });
    },

    leaderboard(): Promise<LeaderboardEntry[]> {
      return request("/api/leaderboard", LeaderboardSchema);
    }
  };
}
