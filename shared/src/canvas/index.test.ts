import { describe, expect, it } from "vitest";
import { CanvasExportError, blobToBytes, exportPNG } from "./index.js";

describe("canvas PNG helpers", () => {
  it("exports the exact PNG blob and converts it to bytes", async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    let requestedType: string | undefined;
    const canvas = {
      toBlob(callback: (blob: Blob | null) => void, type?: string) {
        requestedType = type;
        callback(png);
      }
    };

    const exported = await exportPNG(canvas, { maxBytes: 10 });

    expect(requestedType).toBe("image/png");
    expect(exported).toBe(png);
    expect(await blobToBytes(exported)).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it("rejects an oversized PNG without changing it", async () => {
    const canvas = {
      toBlob(callback: (blob: Blob | null) => void) {
        callback(new Blob([new Uint8Array(11)], { type: "image/png" }));
      }
    };

    await expect(exportPNG(canvas, { maxBytes: 10 })).rejects.toMatchObject({
      name: "CanvasExportError",
      code: "TOO_LARGE"
    } satisfies Partial<CanvasExportError>);
  });

  it("rejects when toBlob produces null blob", async () => {
    const canvas = {
      toBlob(callback: (blob: Blob | null) => void) {
        callback(null);
      }
    };

    await expect(exportPNG(canvas)).rejects.toMatchObject({
      name: "CanvasExportError",
      code: "EMPTY_BLOB"
    } satisfies Partial<CanvasExportError>);
  });

  it("accepts PNG that exactly matches maxBytes", async () => {
    const png = new Blob([new Uint8Array(10)], { type: "image/png" });
    const canvas = {
      toBlob(callback: (blob: Blob | null) => void) {
        callback(png);
      }
    };

    const exported = await exportPNG(canvas, { maxBytes: 10 });
    expect(exported.size).toBe(10);
  });
});
