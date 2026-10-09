export const ANONYMOUS_BROWSER_ID_KEY = "graffiti-wall-anonymous-browser-id";

export interface LikeSummary {
  artworkId: string;
  likes: number;
  likedByMe: boolean;
}

export interface LikeUpdate {
  artworkId: string;
  likes: number;
  likedByMe: boolean;
}

let memoryBrowserId = "";

export function getAnonymousBrowserId(): string {
  try {
    const stored = window.localStorage.getItem(ANONYMOUS_BROWSER_ID_KEY);
    if (stored && isUuidV4(stored)) return stored.toLowerCase();
  } catch { /* Keep a stable in-memory ID for this tab if storage is disabled. */ }

  if (!memoryBrowserId) {
    memoryBrowserId = globalThis.crypto?.randomUUID?.() ?? createUuidFromRandomValues();
    try { window.localStorage.setItem(ANONYMOUS_BROWSER_ID_KEY, memoryBrowserId); } catch { /* Backend still enforces uniqueness for this ID. */ }
  }
  return memoryBrowserId;
}

function createUuidFromRandomValues(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function apiUrl(path: string): string {
  return `${(import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/+$/, "")}${path}`;
}

export async function fetchLikeSummaries(browserId: string): Promise<LikeSummary[]> {
  const url = new URL(apiUrl("/api/likes"));
  url.searchParams.set("browserId", browserId);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await response.json().catch(() => undefined);
  if (!response.ok || !body || !Array.isArray(body.items)) throw new Error("Like counts could not be loaded.");
  return body.items as LikeSummary[];
}

export async function setArtworkLike(artworkId: string, browserId: string, liked: boolean): Promise<LikeUpdate> {
  const response = await fetch(apiUrl("/api/likes"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ artworkId, browserId, liked })
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok || !body || typeof body.likes !== "number" || typeof body.likedByMe !== "boolean") {
    const message = body && typeof body.message === "string" ? body.message : "Your like could not be saved.";
    throw new Error(message);
  }
  return body as LikeUpdate;
}
