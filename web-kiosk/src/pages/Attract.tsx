import { motion } from "framer-motion";
import { ArrowRight, CircleDot, QrCode, Sparkles } from "lucide-react";
import { kioskConfig } from "../lib/config";

type AttractProps = { onStart: () => void };

export function Attract({ onStart }: AttractProps) {
  return (
    <main className="attract-screen">
      <div className="attract-grid" aria-hidden="true" />
      <div className="attract-copy">
        <motion.div
          className="eyebrow"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <CircleDot size={14} /> {kioskConfig.eventName} / public mint station
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          Leave a mark.
          <span>Make it permanent.</span>
        </motion.h1>
        <motion.p
          className="attract-lede"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        >
          Draw a one-of-one tag, anchor its fingerprint on-chain, and take the proof with you.
        </motion.p>
        <motion.button
          className="primary-action"
          onClick={onStart}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.45 }}
        >
          Start drawing <ArrowRight size={22} />
        </motion.button>
        <div className="attract-meta">
          <span><Sparkles size={16} /> 60 seconds</span>
          <span><QrCode size={16} /> QR certificate</span>
          <span>Testnet / no real value</span>
        </div>
      </div>
      <div className="attract-art" aria-hidden="true">
        <div className="art-sticker">DRAW<br />HERE</div>
        <div className="art-ring art-ring-one" />
        <div className="art-ring art-ring-two" />
        <div className="art-caption">YOUR TAG<br /><strong>YOUR PROOF</strong></div>
      </div>
    </main>
  );
}