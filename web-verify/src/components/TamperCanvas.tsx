import { useEffect, useState } from "react";
import { sha256Hex } from "../lib/verify";

interface TamperCanvasProps {
  imageUrl: string;
  imageBytes: ArrayBuffer;
  originalHash: string;
}

interface TamperedCopy {
  imageUrl: string;
  hash: string;
}

export function TamperCanvas({ imageUrl, imageBytes, originalHash }: TamperCanvasProps) {
  const [copy, setCopy] = useState<TamperedCopy>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (copy) URL.revokeObjectURL(copy.imageUrl);
  }, [copy]);

  async function tamper() {
    setBusy(true);
    setError("");
    try {
      const source = new Blob([new Uint8Array(imageBytes)], { type: "image/png" });
      const bitmap = await createImageBitmap(source);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas is unavailable in this browser.");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();

      const pixel = context.getImageData(0, 0, 1, 1);
      pixel.data[0] = (pixel.data[0] + 1) % 256;
      context.putImageData(pixel, 0, 0);
      context.fillStyle = "#ff1744";
      context.beginPath();
      context.arc(canvas.width / 2, canvas.height / 2, Math.max(4, Math.min(canvas.width, canvas.height) / 24), 0, Math.PI * 2);
      context.fill();
      const edited = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The edited image could not be exported.")), "image/png");
      });
      const hash = `0x${await sha256Hex(await edited.arrayBuffer())}`;
      setCopy({ imageUrl: URL.createObjectURL(edited), hash });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be edited.");
    } finally {
      setBusy(false);
    }
  }

  const failed = copy !== undefined && copy.hash.toLowerCase() !== originalHash.toLowerCase();

  return (
    <section className="tamper-card" aria-labelledby="tamper-title">
      <p className="eyebrow">TAMPER DEMO</p>
      <h2 id="tamper-title">Try changing the artwork</h2>
      <p>The edited copy gets a new fingerprint. The original on-chain record stays unchanged.</p>
      <div className="tamper-images">
        <figure><img src={imageUrl} alt="Original verified artwork" /><figcaption>Original</figcaption></figure>
        {copy && <figure><img src={copy.imageUrl} alt="Artwork with one changed pixel" /><figcaption>Edited copy</figcaption></figure>}
      </div>
      <div className="tamper-hashes">
        <div><span>Original fingerprint</span><code>{originalHash}</code></div>
        {copy && <div><span>Edited fingerprint</span><code>{copy.hash}</code></div>}
      </div>
      {copy && <p className={failed ? "tamper-failed" : "tamper-match"} role="status">{failed ? "❌ FAILED — this edited copy does not match the on-chain fingerprint." : "This copy still matches the on-chain fingerprint."}</p>}
      <p className="tamper-teaching">The chain remembers the original fingerprint; any edited copy fails.</p>
      {error && <p className="tamper-failed" role="alert">{error}</p>}
      <button className="tamper-button" type="button" onClick={tamper} disabled={busy}>
        {busy ? "Editing and hashing…" : copy ? "Try again" : "Try to tamper"}
      </button>
    </section>
  );
}
