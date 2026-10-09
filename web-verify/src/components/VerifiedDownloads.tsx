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
    context.font = "600 52px sans-serif";
    context.fillText("AAROH 2026 NFT GRAFFITI WALL", 90, 85);
    context.fillStyle = "#849087";
    context.font = "20px monospace";
    context.fillText("VERIFIED DIGITAL ARTWORK CERTIFICATE", 94, 122);

    const imageSize = 480;
    const imageX = 90;
    const imageY = 160;
    context.fillStyle = "#f7f4eb";
    context.fillRect(imageX - 12, imageY - 12, imageSize + 24, imageSize + 24);
    const scale = Math.min(imageSize / artwork.naturalWidth, imageSize / artwork.naturalHeight);
    const drawWidth = artwork.naturalWidth * scale;
    const drawHeight = artwork.naturalHeight * scale;
    context.drawImage(artwork, imageX + (imageSize - drawWidth) / 2, imageY + (imageSize - drawHeight) / 2, drawWidth, drawHeight);

    const rightX = 640;
    context.fillStyle = "#d7ff4f";
    context.font = "18px monospace";
    context.fillText("CREATOR", rightX, 175);
    context.fillStyle = "#f4f1e8";
    context.font = "600 42px sans-serif";
    context.fillText(result.nickname || "Anonymous", rightX, 220, 680);
    context.fillStyle = "#d7ff4f";
    context.font = "20px monospace";
    context.fillText(`TOKEN #${result.tokenId}`, rightX, 270);
    context.fillStyle = "#bbc5bc";
    context.font = "18px monospace";
    context.fillText(new Date(Number(result.timestamp) * 1_000).toLocaleString(), rightX, 310, 680);
    context.fillText(`SHA-256  ${result.onChainHash.slice(0, 26)}…`, rightX, 348);
    context.fillStyle = "#63e6a7";
    context.font = "18px monospace";
    context.fillText("✓ ON-CHAIN VERIFICATION PASSED", rightX, 385);

    context.strokeStyle = "#354263";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(rightX, 420);
    context.lineTo(1320, 420);
    context.stroke();

    context.fillStyle = "#dbe6ff";
    context.font = "500 20px sans-serif";
    context.fillText("This certificate is awarded in recognition of your", rightX, 465);
    context.fillText("creativity and participation in AAROH 2026 NFT Graffiti Wall", rightX, 498);

    context.fillStyle = "#d7ff4f";
    context.font = "600 24px sans-serif";
    context.fillText("Blockchain Club, Betalabs IIIT KOTTAYAM", rightX, 560);

    const galleryUrl = import.meta.env.VITE_GALLERY_URL || "http://localhost:5174";
    context.fillStyle = "#aab6d5";
    context.font = "18px monospace";
    context.fillText(`Gallery: ${galleryUrl}`, 90, 710);

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
