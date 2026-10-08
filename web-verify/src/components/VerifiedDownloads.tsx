import { useEffect, useState } from "react";
import type { VerificationResult } from "../lib/verify";

function imageFile(result: VerificationResult): File {
  const bytes = new Uint8Array(result.imageBytes);
  const signature = [...bytes.slice(0, 12)];
  let type = "image/png";
  let extension = "png";
  if (signature[0] === 0xff && signature[1] === 0xd8) { type = "image/jpeg"; extension = "jpg"; }
  else if (String.fromCharCode(...signature.slice(0, 4)) === "GIF8") { type = "image/gif"; extension = "gif"; }
  else if (String.fromCharCode(...signature.slice(0, 4)) === "RIFF" && String.fromCharCode(...signature.slice(8, 12)) === "WEBP") { type = "image/webp"; extension = "webp"; }
  return new File([result.imageBytes], `graffiti-wall-${result.tokenId}.${extension}`, { type });
}

async function certificateFile(result: VerificationResult): Promise<File> {
  const artwork = new Image();
  const artworkUrl = URL.createObjectURL(new Blob([result.imageBytes]));
  try {
    await new Promise<void>((resolve, reject) => {
      artwork.onload = () => resolve();
      artwork.onerror = () => reject(new Error("Could not prepare the certificate artwork."));
      artwork.src = artworkUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 900;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the certificate.");

    context.fillStyle = "#101313";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#d7ff4f";
    context.fillRect(0, 0, 18, canvas.height);
    context.fillStyle = "#f4f1e8";
    context.font = "600 64px sans-serif";
    context.fillText("GRAFFITI WALL", 90, 105);
    context.fillStyle = "#849087";
    context.font = "24px monospace";
    context.fillText("VERIFIED DIGITAL ARTWORK", 94, 145);

    const imageSize = 560;
    const imageX = 90;
    const imageY = 215;
    context.fillStyle = "#f7f4eb";
    context.fillRect(imageX - 12, imageY - 12, imageSize + 24, imageSize + 24);
    const scale = Math.min(imageSize / artwork.naturalWidth, imageSize / artwork.naturalHeight);
    const drawWidth = artwork.naturalWidth * scale;
    const drawHeight = artwork.naturalHeight * scale;
    context.drawImage(artwork, imageX + (imageSize - drawWidth) / 2, imageY + (imageSize - drawHeight) / 2, drawWidth, drawHeight);

    context.fillStyle = "#d7ff4f";
    context.font = "24px monospace";
    context.fillText("CREATOR", 750, 245);
    context.fillStyle = "#f4f1e8";
    context.font = "600 48px sans-serif";
    context.fillText(result.nickname || "Anonymous", 750, 310, 560);
    context.fillStyle = "#d7ff4f";
    context.font = "24px monospace";
    context.fillText(`TOKEN #${result.tokenId}`, 750, 385);
    context.fillStyle = "#bbc5bc";
    context.font = "20px monospace";
    context.fillText(new Date(Number(result.timestamp) * 1_000).toLocaleString(), 750, 430, 560);
    context.fillText(`SHA-256  ${result.onChainHash.slice(0, 22)}…`, 750, 500);
    context.fillText("ON-CHAIN VERIFICATION PASSED", 750, 555);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not create the certificate image.");
    return new File([blob], `graffiti-wall-certificate-${result.tokenId}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(artworkUrl);
  }
}

function saveFile(file: File, title: string) {
  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    void navigator.share({ files: [file], title }).catch(() => undefined);
    return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

interface VerifiedDownloadsProps { result: VerificationResult; }

export function VerifiedDownloads({ result }: VerifiedDownloadsProps) {
  const [certificate, setCertificate] = useState<File>();
  const [error, setError] = useState("");
  const artwork = imageFile(result);

  useEffect(() => {
    let active = true;
    setCertificate(undefined);
    setError("");
    certificateFile(result).then((file) => {
      if (active) setCertificate(file);
    }).catch(() => {
      if (active) setError("Certificate download is unavailable. You can still save the artwork.");
    });
    return () => { active = false; };
  }, [result]);

  return <section className="download-card" aria-label="Save your ticket files">
    <h2>Keep your certificate</h2>
    <p>Save these files to your phone. They are prepared in this browser and are not uploaded.</p>
    <div className="download-actions">
      <button type="button" onClick={() => certificate && saveFile(certificate, "Graffiti Wall certificate")} disabled={!certificate}>Download certificate</button>
      <button type="button" onClick={() => saveFile(artwork, "Graffiti Wall artwork")}>Download NFT artwork</button>
    </div>
    {error && <p role="status">{error}</p>}
  </section>;
}
