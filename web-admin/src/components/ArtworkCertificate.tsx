import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { buildVerifyUrl } from "@graffiti/shared/qr";
import { ApiError, getCertificateDetails } from "../lib/api";
import type { GalleryItem } from "../types";
import { artworkImageCandidates } from "../lib/api";

interface ArtworkCertificateProps {
  item: GalleryItem;
  token: string;
  onClose: () => void;
  onUnauthorized: (message: string) => void;
}

function publicVerifyBase(): string {
  const value = import.meta.env.VITE_VERIFY_URL || "https://nft-graffiti-wallwebverify.vercel.app/";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ? url.toString().replace(/\/+$/, "") : "";
  } catch { return ""; }
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "an unknown time" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function ArtworkCertificate({ item, token, onClose, onUnauthorized }: ArtworkCertificateProps) {
  const [txHash, setTxHash] = useState("");
  const [mintedAt, setMintedAt] = useState("");
  const [error, setError] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const imageCandidates = artworkImageCandidates(item);
  const verifyBase = publicVerifyBase();
  const verifyUrl = verifyBase && item.tokenId != null ? buildVerifyUrl(verifyBase, item.tokenId) : "";

  useEffect(() => {
    let active = true;
    getCertificateDetails(item.id, token).then((details) => {
      if (active) { setTxHash(details.txHash); setMintedAt(details.mintedAt); }
    }).catch((cause: unknown) => {
      const message = cause instanceof Error ? cause.message : "Certificate transaction details could not be loaded.";
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(message);
      else if (active) setError(message);
    });
    return () => { active = false; };
  }, [item.id, token, onUnauthorized]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="certificate-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="certificate-modal" role="dialog" aria-modal="true" aria-labelledby="admin-certificate-name">
        <button className="certificate-modal-close" type="button" onClick={onClose} aria-label="Close certificate">×</button>
        <div className="admin-certificate-card">
          <div className="admin-certificate-artwork">
            {imageCandidates[imageIndex]
              ? <img src={imageCandidates[imageIndex]} alt={`${item.nickname}'s graffiti`} onError={() => setImageIndex((index) => index + 1)} />
              : <span>Artwork preview unavailable</span>}
          </div>
          <div className="admin-certificate-content">
            <div className="admin-certificate-kicker">Graffiti Wall / proof of creation</div>
            <h2 id="admin-certificate-name">{item.nickname}</h2>
            <div className="admin-certificate-token">Token #{item.tokenId}</div>
            <p className="admin-certificate-date">Minted {formatDate(mintedAt || item.createdAt)}</p>
            <div className="admin-certificate-rule" />
            <dl className="admin-certificate-data">
              <div><dt>SHA-256</dt><dd title={item.sha256}>{item.sha256.slice(0, 18)}...</dd></div>
              <div><dt>Transaction</dt><dd title={txHash}>{txHash ? `${txHash.slice(0, 18)}...` : error || "Loading…"}</dd></div>
            </dl>
          </div>
          <div className="admin-certificate-qr">
            {verifyUrl ? <><QRCodeCanvas value={verifyUrl} size={164} level="H" includeMargin /><span>Scan to verify</span></>
              : <span className="admin-certificate-qr-error">Set VITE_VERIFY_URL to the deployed HTTPS verifier URL.</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
