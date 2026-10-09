import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";
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

export function CertificateCard({ artwork, nickname, job }: CertificateCardProps) {
  const [artworkUrl, setArtworkUrl] = useState("");
  const verifyUrl = kioskConfig.verifyUrl ? buildVerifyUrl(kioskConfig.verifyUrl, job.tokenId!) : "";
  const mintedAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date());

  useEffect(() => {
    const url = URL.createObjectURL(artwork.blob);
    setArtworkUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [artwork.blob]);

  return (
    <section className="certificate-wrap">
      <div className="certificate-card" id="certificate-card">
        <div className="certificate-artwork"><img src={artworkUrl || undefined} alt={`${nickname}'s graffiti`} /></div>
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
          {verifyUrl ? <><QRCodeCanvas value={verifyUrl} size={164} level="H" includeMargin /><span><QrCode size={14} /> Scan to verify</span></> : <span className="certificate-qr-error">Set VITE_VERIFY_URL to the deployed HTTPS verifier URL</span>}
        </div>
      </div>
    </section>
  );
}
