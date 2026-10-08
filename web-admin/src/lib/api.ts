import type { GalleryItem, QueueStatus } from "../types";

const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export interface HealthSummary {
  ok: boolean;
  chain: boolean;
  ipfs: boolean;
  queueDepth: number | false;
  balanceEth: number | false;
}

export interface AdminConfig {
  KILL_SWITCH: boolean;
  IPFS_PROVIDER: "pinata" | "kubo";
}

export interface AdminJob {
  jobId: string;
  stage: "hashing" | "uploading" | "ready" | "minting" | "confirmed" | "failed" | "unknown";
  imageCID?: string;
  metadataCID?: string;
  retry?: number;
  error?: string;
  tokenId?: number;
}

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${token}` }
  });
  let body: unknown;
  try { body = await response.json(); } catch { body = undefined; }
  if (!response.ok) {
    const detail = body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : response.status === 401 ? "The admin token was rejected." : `Request failed (${response.status}).`;
    throw new ApiError(detail, response.status);
  }
  return body as T;
}

export function getHealth(token: string): Promise<HealthSummary> {
  return request<HealthSummary>("/api/health", token);
}

export function getAdminConfig(token: string): Promise<AdminConfig> {
  // The backend returns its complete config after any PUT; an empty patch reads it without changing settings.
  return updateAdminConfig({}, token);
}

export function updateAdminConfig(patch: Partial<AdminConfig>, token: string): Promise<AdminConfig> {
  return request<AdminConfig>("/api/admin/config", token, { method: "PUT", body: JSON.stringify(patch) });
}

export interface ArchiveResult {
  ok: boolean;
  archiveId: string;
  artworkCount: number;
  voteCount: number;
}

export interface ClearQueueResult {
  ok: boolean;
  archiveId: string;
  artworkCount: number;
  voteCount: number;
  skippedMintingCount?: number;
}

export function archiveWall(confirm: string, token: string): Promise<ArchiveResult> {
  return request<ArchiveResult>("/api/admin/reset", token, { method: "POST", body: JSON.stringify({ confirm }) });
}

export function clearGallery(token: string): Promise<ClearQueueResult> {
  return request<ClearQueueResult>("/api/admin/clear-gallery", token, { method: "POST", body: JSON.stringify({ confirm: "CLEAR GALLERY" }) });
}

export function clearMintRequests(token: string): Promise<ClearQueueResult> {
  return request<ClearQueueResult>("/api/admin/clear-mint-requests", token, { method: "POST", body: JSON.stringify({ confirm: "CLEAR MINT REQUESTS" }) });
}

export async function listQueue(status: QueueStatus, token: string): Promise<GalleryItem[]> {
  const items: GalleryItem[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ status, limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await request<{ items: GalleryItem[]; nextCursor?: string | null }>(`/api/gallery?${query}`, token);
    items.push(...page.items);
    cursor = page.nextCursor ?? null;
  } while (cursor);
  return items;
}

export async function mintArtwork(id: string, token: string): Promise<GalleryItem> {
  const result = await request<{ item?: GalleryItem }>(`/api/admin/artworks/${encodeURIComponent(id)}/mint`, token, { method: "POST" });
  if (!result.item) throw new ApiError("The server did not return the updated artwork.", 502);
  return result.item;
}

export async function hideArtwork(id: string, token: string): Promise<GalleryItem> {
  const result = await request<{ item?: GalleryItem }>(`/api/admin/artworks/${encodeURIComponent(id)}/hide`, token, { method: "POST" });
  if (!result.item) throw new ApiError("The server did not return the updated artwork.", 502);
  return result.item;
}

export async function restoreArtwork(id: string, token: string): Promise<GalleryItem> {
  const result = await request<{ item?: GalleryItem }>(`/api/admin/artworks/${encodeURIComponent(id)}/restore`, token, { method: "POST" });
  if (!result.item) throw new ApiError("The server did not return the restored artwork.", 502);
  return result.item;
}

export function retryArtworkIpfs(id: string, token: string): Promise<{ job: AdminJob }> {
  return request<{ job: AdminJob }>(`/api/admin/artworks/${encodeURIComponent(id)}/retry-ipfs`, token, { method: "POST" });
}

export function getArtworkJob(id: string, token: string): Promise<AdminJob> {
  return request<AdminJob>(`/api/artworks/${encodeURIComponent(id)}/status`, token);
}

function ipfsGatewayUrl(cid: string, gateway: string): string {
  const base = gateway.replace(/\/+$/, "");
  return `${base.endsWith("/ipfs") ? base : `${base}/ipfs`}/${cid}`;
}

export function artworkImageCandidates(item: GalleryItem): string[] {
  const rawUrl = item.imageUrl ?? "";
  if (rawUrl && !rawUrl.startsWith("ipfs://")) {
    try { return [new URL(rawUrl, apiBase || window.location.origin).toString()]; }
    catch { return []; }
  }

  const cid = (rawUrl.startsWith("ipfs://") ? rawUrl.slice("ipfs://".length) : item.imageCID).replace(/^ipfs\//, "");
  if (!cid) return [];
  const configuredGateway = (import.meta.env.VITE_IPFS_GATEWAY ?? "https://ipfs.io").replace(/\/+$/, "");
  return [...new Set([
    ipfsGatewayUrl(cid, configuredGateway),
    ipfsGatewayUrl(cid, "https://ipfs.io"),
    ipfsGatewayUrl(cid, "https://dweb.link")
  ])];
}

export function artworkImageUrl(item: GalleryItem): string {
  return artworkImageCandidates(item)[0] ?? "";
}
