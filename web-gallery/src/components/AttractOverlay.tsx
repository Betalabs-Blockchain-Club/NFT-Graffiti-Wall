import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Sparkles, Palette, ShieldCheck, QrCode } from "lucide-react";

interface AttractOverlayProps {
  onDismiss?: () => void;
  isDismissable?: boolean;
}

export const AttractOverlay: React.FC<AttractOverlayProps> = ({
  onDismiss,
  isDismissable = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    // Generate QR code for kiosk / verify url
    const targetUrl =
      import.meta.env.VITE_VERIFY_URL ||
      import.meta.env.VITE_KIOSK_URL ||
      window.location.origin;

    QRCode.toDataURL(targetUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: "#0a0a0f",
        light: "#ffffff",
      },
    })
      .then(setQrDataUrl)
      .catch((err) => console.warn("[web-gallery] QR gen error:", err));
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto my-auto ${
        isDismissable ? "cursor-pointer" : ""
      }`}
      onClick={isDismissable ? onDismiss : undefined}
    >
      {/* Neon pill badge */}
      <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 font-mono text-sm uppercase tracking-widest mb-6 animate-pulse">
        <Sparkles className="w-4 h-4" />
        <span>Live Expo Demonstration</span>
      </div>

      {/* Hero Headline */}
      <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-6 uppercase">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400">
          Draw it. Mint it. Own it.
        </span>
      </h1>

      <p className="text-lg md:text-2xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
        Step up to the kiosk drawing tablet. Leave your tag on the collaborative
        wall, anchor its cryptographic fingerprint on-chain, and take home a
        verifiable NFT certificate.
      </p>

      {/* 3 Step Flow Pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl mb-12 text-left">
        <div className="p-5 rounded-2xl bg-[#141724]/80 border border-slate-800 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center mb-3">
            <Palette className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-lg mb-1">1. Tag the Wall</h3>
          <p className="text-sm text-slate-400">
            Pick your brush & spray your graffiti in 60 seconds on the kiosk.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141724]/80 border border-slate-800 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-lg mb-1">2. SHA-256 & Mint</h3>
          <p className="text-sm text-slate-400">
            Artwork bytes are hashed, pinned to IPFS, and minted to the blockchain.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141724]/80 border border-slate-800 backdrop-blur-sm">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-lg mb-1">3. Live Proof</h3>
          <p className="text-sm text-slate-400">
            Scan your certificate QR to verify cryptographic authenticity on your phone.
          </p>
        </div>
      </div>

      {/* QR Code Card */}
      {qrDataUrl && (
        <div className="flex flex-col items-center bg-[#121422] border border-cyan-500/30 p-5 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.15)]">
          <div className="bg-white p-2 rounded-xl mb-3 shadow-inner">
            <img
              src={qrDataUrl}
              alt="Scan to Verify"
              className="w-36 h-36 object-contain"
            />
          </div>
          <div className="text-cyan-300 font-mono text-xs tracking-wider uppercase font-semibold">
            Scan to view & verify on mobile
          </div>
          <div className="text-slate-400 text-[11px] mt-1 font-mono">
            Testnet = pure tech demo (no financial value)
          </div>
        </div>
      )}

      {isDismissable && (
        <div className="mt-8 text-xs text-slate-500 font-mono">
          Click anywhere or press any key to view the live wall
        </div>
      )}
    </div>
  );
};
