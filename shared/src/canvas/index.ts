export interface ExportPNGOptions {
  maxBytes?: number;
}

export class CanvasExportError extends Error {
  readonly code: "EMPTY_BLOB" | "TOO_LARGE";

  constructor(code: "EMPTY_BLOB" | "TOO_LARGE", message: string) {
    super(message);
    this.name = "CanvasExportError";
    this.code = code;
  }
}

export type CanvasWithToBlob = {
  toBlob(callback: (blob: Blob | null) => void, type?: string): void;
};

export function exportPNG(
  canvas: CanvasWithToBlob,
  { maxBytes }: ExportPNGOptions = {}
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new CanvasExportError("EMPTY_BLOB", "Canvas export returned no PNG blob"));
        return;
      }

      if (maxBytes !== undefined && blob.size > maxBytes) {
        reject(
          new CanvasExportError(
            "TOO_LARGE",
            `PNG is ${blob.size} bytes; maximum is ${maxBytes} bytes`
          )
        );
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

export async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
