import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, Printer, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { buildVerifyUrl } from "@graffiti/shared/qr";
import type { ArtworkExport } from "../DrawingCanvas/DrawingCanvas";
import type { MintJobState } from "../../hooks/useMintJob";
import { kioskConfig } from "../../lib/config";

type CertificateCardProps = {
  artwork: ArtworkExport;
  nickname: string;
  job: MintJobState;
};

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load artwork for download"));
    image.src = source;
  });
}

export function CertificateCard({ artwork, nickname, job }: CertificateCardProps) {
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);
  const artworkUrl = useMemo(() => URL.createObjectURL(artwork.blob), [artwork.blob]);
  const verifyUrl = buildVerifyUrl(kioskConfig.verifyUrl, job.tokenId ?? "pending");
  const mintedAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date());

  useEffect(() => () => URL.revokeObjectURL(artworkUrl), [artworkUrl]);

  const downloadCertificate = async () => {
    if (!job.tokenId || downloading) return;
    setDownloading(true);
    try {
      const image = await loadImage(artworkUrl);
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 900;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Certificate canvas is unavailable");

      context.fillStyle = "#101313";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#d7ff4f";
      context.fillRect(0, 0, 18, canvas.height);
      context.fillStyle = "#f4f1e8";
      context.font = "600 64px Space Grotesk, sans-serif";
      context.fillText("GRAFFITI WALL", 90, 105);
      context.fillStyle = "#849087";
      context.font = "24px DM Mono, monospace";
      context.fillText("VERIFIABLE DIGITAL ARTWORK", 94, 145);

      const imageSize = 560;
      const imageX = 90;
      const imageY = 215;
      context.fillStyle = "#f7f4eb";
      context.fillRect(imageX - 12, imageY - 12, imageSize + 24, imageSize + 24);
      const scale = Math.min(imageSize / image.width, imageSize / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      context.drawImage(image, imageX + (imageSize - drawWidth) / 2, imageY + (imageSize - drawHeight) / 2, drawWidth, drawHeight);

      context.fillStyle = "#d7ff4f";
      context.font = "500 24px DM Mono, monospace";
      context.fillText("CREATOR", 750, 245);
      context.fillStyle = "#f4f1e8";
      context.font = "600 52px Space Grotesk, sans-serif";
      context.fillText(nickname, 750, 305);
      context.fillStyle = "#d7ff4f";
      context.font = "500 24px DM Mono, monospace";
      context.fillText(`TOKEN #${job.tokenId}`, 750, 385);
      context.fillStyle = "#bbc5bc";
      context.font = "20px DM Mono, monospace";
      context.fillText(mintedAt, 750, 430);
      context.fillText(`SHA-256  ${artwork.clientHash.slice(0, 24)}...`, 750, 500);
      context.fillText(`TX       ${job.txHash?.slice(0, 24) ?? "pending"}...`, 750, 535);

      if (qrRef.current) context.drawImage(qrRef.current, 1010, 600, 220, 220);
      context.fillStyle = "#849087";
      context.font = "18px DM Mono, monospace";
      context.fillText("SCAN TO VERIFY", 1015, 845);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not create certificate download");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `graffiti-wall-${job.tokenId}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="certificate-wrap">
      <div className="certificate-card" id="certificate-card">
        <div className="certificate-artwork"><img src={artworkUrl} alt={`${nickname}'s graffiti`} /></div>
        <div className="certificate-content">
          <div className="certificate-kicker">Graffiti Wall / proof of creation</div>
          <h1>{nickname}</h1>
          <div className="certificate-token">Token #{job.tokenId}</div>
          <p className="certificate-date">Minted {mintedAt}</p>
          <div className="certificate-rule" />
          <dl className="certificate-data">
            <div><dt>SHA-256</dt><dd title={artwork.clientHash}>{artwork.clientHash.slice(0, 18)}...</dd></div>
            <div><dt>Transaction</dt><dd title={job.txHash}>{job.txHash?.slice(0, 18) ?? "pending"}...</dd></div>
          </dl>
        </div>
        <div className="certificate-qr">
          <QRCodeCanvas ref={qrRef} value={verifyUrl} size={164} level="H" includeMargin />
          <span><QrCode size={14} /> Scan to verify</span>
        </div>
      </div>
      <div className="certificate-actions">
        <button className="primary-action" onClick={() => void downloadCertificate()} disabled={downloading || !job.tokenId}><Download size={19} /> {downloading ? "Preparing..." : "Download certificate"}</button>
        <button className="secondary-action" onClick={() => window.print()}><Printer size={19} /> Print</button>
        <a className="secondary-action" href={verifyUrl} target="_blank" rel="noreferrer"><ExternalLink size={18} /> Open verifier</a>
      </div>
    </section>
  );
}