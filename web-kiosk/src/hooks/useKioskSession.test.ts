import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearKioskSession,
  loadDrawingDraft,
  loadKioskSession,
  restoreArtwork,
  saveArtwork,
  saveDrawingDraft,
  saveKioskSession,
} from "./useKioskSession";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("kiosk session persistence", () => {
  it("merges workflow fields and clears values explicitly", () => {
    vi.stubGlobal("window", { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() });
    saveKioskSession({ nickname: "Neon Fox", submissionId: "submission-1", jobId: "job-1" });
    saveKioskSession({ nickname: undefined });
    expect(loadKioskSession()).toEqual({ submissionId: "submission-1", jobId: "job-1" });
  });

  it("restores the drawing image settings and remaining timer", () => {
    vi.stubGlobal("window", { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() });
    saveDrawingDraft({ dataUrl: "data:image/png;base64,AA==", seconds: 24, hasStarted: true, color: "#ff00ff", brushSize: 30, tool: "eraser" });
    expect(loadDrawingDraft()).toEqual({ dataUrl: "data:image/png;base64,AA==", seconds: 24, hasStarted: true, color: "#ff00ff", brushSize: 30, tool: "eraser" });
  });

  it("round-trips the exported artwork bytes for refresh recovery", async () => {
    vi.stubGlobal("window", { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() });
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const blob = new Blob([bytes], { type: "image/png" });
    await saveArtwork({ blob, bytes, clientHash: "a".repeat(64) });
    const restored = await restoreArtwork();
    expect(restored?.clientHash).toBe("a".repeat(64));
    expect([...restored!.bytes]).toEqual([...bytes]);
  });

  it("clears the saved workflow and drawing draft when the visitor resets", () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage, sessionStorage });
    saveKioskSession({ nickname: "Neon Fox" });
    saveDrawingDraft({ dataUrl: "data:image/png;base64,AA==", seconds: 24, hasStarted: true, color: "#101313", brushSize: 18, tool: "brush" });
    clearKioskSession();
    expect(loadKioskSession()).toEqual({});
    expect(loadDrawingDraft()).toBeNull();
  });
});
