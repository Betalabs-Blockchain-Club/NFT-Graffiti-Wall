import { useEffect, useState } from "react";
import type { ArtworkExport } from "../components/DrawingCanvas/DrawingCanvas";
import type { MintJobState } from "./useMintJob";

const SESSION_KEY = "graffiti-wall-kiosk-session";
const SESSION_ARTWORK_KEY = "graffiti-wall-kiosk-artwork";
const DRAWING_KEY = "graffiti-wall-kiosk-drawing";
const DRAWING_IMAGE_KEY = "graffiti-wall-kiosk-drawing-image";

export interface KioskSession {
  artworkDataUrl?: string;
  clientHash?: string;
  nickname?: string;
  submissionId?: string;
  jobId?: string;
  job?: MintJobState;
}

export interface DrawingDraft {
  dataUrl?: string;
  seconds: number;
  hasStarted: boolean;
  color: string;
  brushSize: number;
  tool: "brush" | "eraser";
}

function loadSessionMetadata(): KioskSession {
  try {
    const value = window.localStorage.getItem(SESSION_KEY);
    if (!value) return {};
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return {};
    const { artworkDataUrl: _ignored, ...metadata } = parsed as KioskSession;
    return metadata;
  } catch {
    return {};
  }
}

export function loadKioskSession(): KioskSession {
  try {
    return {
      ...loadSessionMetadata(),
      artworkDataUrl: window.localStorage.getItem(SESSION_ARTWORK_KEY) ?? undefined,
    };
  } catch {
    return loadSessionMetadata();
  }
}

export function saveKioskSession(patch: Partial<KioskSession>): void {
  try {
    if (Object.prototype.hasOwnProperty.call(patch, "artworkDataUrl")) {
      if (patch.artworkDataUrl) window.localStorage.setItem(SESSION_ARTWORK_KEY, patch.artworkDataUrl);
      else window.localStorage.removeItem(SESSION_ARTWORK_KEY);
    }
    const { artworkDataUrl: _ignored, ...metadataPatch } = patch;
    const next = { ...loadSessionMetadata(), ...metadataPatch };
    for (const [key, value] of Object.entries(metadataPatch)) if (value === undefined) delete next[key as keyof KioskSession];
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory flow available when browser storage is blocked or full.
  }
}

export function clearKioskSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(SESSION_ARTWORK_KEY);
    window.sessionStorage.removeItem(DRAWING_KEY);
    window.sessionStorage.removeItem(DRAWING_IMAGE_KEY);
  } catch {
    // The current page can still continue without persisted session data.
  }
}

export function loadDrawingDraft(): DrawingDraft | null {
  try {
    const value = window.sessionStorage.getItem(DRAWING_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<DrawingDraft>;
    if (typeof parsed.seconds !== "number") return null;
    return {
      dataUrl: window.sessionStorage.getItem(DRAWING_IMAGE_KEY) ?? undefined,
      seconds: Math.max(0, Math.min(60, Math.floor(parsed.seconds))),
      hasStarted: Boolean(parsed.hasStarted),
      color: typeof parsed.color === "string" ? parsed.color : "#101313",
      brushSize: typeof parsed.brushSize === "number" ? parsed.brushSize : 18,
      tool: parsed.tool === "eraser" ? "eraser" : "brush",
    };
  } catch {
    return null;
  }
}

export function saveDrawingDraft(draft: DrawingDraft, saveImage = true): void {
  try {
    const { dataUrl, ...metadata } = draft;
    if (saveImage) {
      if (dataUrl) window.sessionStorage.setItem(DRAWING_IMAGE_KEY, dataUrl);
      else window.sessionStorage.removeItem(DRAWING_IMAGE_KEY);
    }
    window.sessionStorage.setItem(DRAWING_KEY, JSON.stringify(metadata));
  } catch {
    // Canvas use remains available if the draft exceeds browser storage limits.
  }
}

export async function saveArtwork(artwork: ArtworkExport): Promise<void> {
  const bytes = new Uint8Array(await artwork.blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  const artworkDataUrl = `data:${artwork.blob.type || "image/png"};base64,${btoa(binary)}`;
  saveKioskSession({ artworkDataUrl, clientHash: artwork.clientHash });
}

export async function restoreArtwork(session = loadKioskSession()): Promise<ArtworkExport | undefined> {
  if (!session.artworkDataUrl || !session.clientHash) return undefined;
  try {
    const blob = await (await fetch(session.artworkDataUrl)).blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { blob, bytes, clientHash: session.clientHash };
  } catch {
    return undefined;
  }
}

export function useRestoredArtwork(initial?: ArtworkExport): ArtworkExport | undefined {
  const [artwork, setArtwork] = useState(initial);

  useEffect(() => {
    if (initial) {
      setArtwork(initial);
      return;
    }
    let active = true;
    void restoreArtwork().then((restored) => {
      if (active && restored) setArtwork(restored);
    });
    return () => { active = false; };
  }, [initial]);

  return artwork;
}
