import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { GalleryItem } from "../types";
import { Sparkles, Hash, User } from "lucide-react";
import { artworkImageUrl } from "../hooks/useGallerySocket";

interface NewArtToastProps {
  item: GalleryItem | null;
  onDismiss: () => void;
}

export const NewArtToast: React.FC<NewArtToastProps> = ({ item, onDismiss }) => {
  useEffect(() => {
    if (item) {
      // Trigger festive confetti cannons
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#ff007f", "#00f0ff", "#39ff14", "#b026ff", "#ffe600"],
        });

        // Extra celebratory bursts
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ["#ff007f", "#00f0ff", "#ffe600"],
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ["#39ff14", "#b026ff", "#00f0ff"],
          });
        }, 250);
      } catch (err) {
        console.warn("[web-gallery] Confetti error:", err);
      }

      // Auto dismiss after 6 seconds
      const timer = setTimeout(() => {
        onDismiss();
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [item, onDismiss]);

  const imageUrl = item ? artworkImageUrl(item) : "";

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -40 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md pointer-events-auto cursor-pointer"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ rotate: -2 }}
            animate={{ rotate: 0 }}
            className="relative max-w-xl w-full bg-[#121422] border-2 border-pink-500 rounded-3xl p-6 shadow-[0_0_50px_rgba(255,0,127,0.4)] text-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient neon backdrop glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Badge header */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 font-mono text-sm uppercase tracking-wider mb-4 animate-pulse">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span>New Graffiti Dropped!</span>
            </div>

            {/* Artwork Zoom-In Display */}
            <div className="relative mx-auto w-64 h-64 md:w-80 md:h-80 bg-[#0d0f17] border border-gray-700 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center p-2 mb-5">
              <img
                src={imageUrl}
                alt={item.nickname}
                className="w-full h-full object-contain rounded-xl"
                onError={(e) => {
                  // Fallback placeholder
                  (e.target as HTMLImageElement).src =
                    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%231f2438'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23ff007f' font-size='16'>Graffiti Art</text></svg>";
                }}
              />
            </div>

            {/* Metadata info */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-2xl md:text-3xl font-extrabold text-white tracking-wide">
                <User className="w-6 h-6 text-cyan-400" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400">
                  {item.nickname}
                </span>
              </div>

              {item.tokenId !== undefined && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-950/60 border border-cyan-500/40 rounded-lg text-cyan-300 font-mono text-sm">
                  <Hash className="w-4 h-4 text-cyan-400" />
                  <span>Token #{item.tokenId}</span>
                </div>
              )}

              <p className="text-xs text-gray-400 font-mono pt-2">
                Click anywhere to continue viewing the wall
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
