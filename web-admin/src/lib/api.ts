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
  MODERATION_MODE: "display_after_approve" | "mint_after_approve";
  KILL_SWITCH: boolean;
  IPFS_PROVIDER: "pinata" | "kubo";
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

export function archiveWall(confirm: string, token: string): Promise<ArchiveResult> {
  return request<ArchiveResult>("/api/admin/reset", token, { method: "POST", body: JSON.stringify({ confirm }) });
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

export async function moderate(id: string, action: "approve" | "hide", token: string): Promise<GalleryItem> {
  const result = await request<{ item?: GalleryItem }>(`/api/admin/artworks/${encodeURIComponent(id)}/${action}`, token, { method: "POST" });
  if (!result.item) throw new ApiError("The server did not return the updated artwork.", 502);
  return result.item;
}

export function artworkImageUrl(item: GalleryItem): string {
  const candidate = item.imageUrl || (item.imageCID
    ? `${(import.meta.env.VITE_IPFS_GATEWAY ?? "").replace(/\/+$/, "")}/ipfs/${encodeURIComponent(item.imageCID)}`
    : "");
  if (!candidate) return "";
  try { return new URL(candidate, apiBase || window.location.origin).toString(); }
  catch { return ""; }
}
