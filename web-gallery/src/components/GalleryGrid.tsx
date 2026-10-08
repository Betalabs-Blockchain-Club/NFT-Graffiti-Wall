import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GalleryItem } from "../types";
import { VoteBar } from "./VoteBar";
import { ArtworkImage } from "./ArtworkImage";
import { Hash, Sparkles, X } from "lucide-react";

interface GalleryGridProps {
  items: GalleryItem[];
  hasLeaderboard: boolean;
}

export const GalleryGrid: React.FC<GalleryGridProps> = ({ items, hasLeaderboard }) => {
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  // Find max votes for scaling vote bars across the grid
  const maxVotes = useMemo(() => {
    let max = 1;
    for (const item of items) {
      if (item.votes && item.votes > max) {
        max = item.votes;
      }
    }
    return max;
  }, [items]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-5 p-4 md:p-6">
      {items.map((item, index) => {
        const isNewest = index === 0;

        return (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.25 }}
            className={`group relative flex flex-col bg-[#11131e]/90 rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${
              isNewest
                ? "border-pink-500/70 shadow-[0_0_20px_rgba(255,0,127,0.25)] ring-1 ring-pink-500/50"
                : "border-slate-800/90 hover:border-slate-700 shadow-md"
            }`}
          >
            {/* Top New badge on the freshest item */}
            {isNewest && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500 text-white font-mono text-[10px] uppercase font-bold tracking-wider shadow-lg animate-pulse">
                <Sparkles className="w-2.5 h-2.5" />
                <span>NEW</span>
              </div>
            )}

            {/* Artwork Canvas Container */}
            <button
              type="button"
              onClick={() => setSelectedItem(item)}
              aria-label={`Open artwork by ${item.nickname}`}
              className="relative aspect-square w-full bg-white flex items-center justify-center p-2 overflow-hidden cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-400"
            >
              <ArtworkImage
                item={item}
                className="w-full h-full object-contain rounded-lg bg-white transition-transform duration-300 group-hover:scale-105"
              />
            </button>

            {/* Card Content & Metadata */}
            <div className="p-3 flex flex-col flex-grow justify-between bg-[#11131e]">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className="font-bold text-sm text-slate-100 truncate group-hover:text-pink-400 transition-colors"
                    title={item.nickname}
                  >
                    {item.nickname}
                  </span>
                  {item.tokenId !== undefined && item.tokenId !== null && (
                    <span className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 font-mono text-[10px]">
                      <Hash className="w-2.5 h-2.5 text-cyan-400" />
                      {item.tokenId}
                    </span>
                  )}
                </div>

                {/* Fingerprint / Hash snippet */}
                {item.sha256 && (
                  <div className="font-mono text-[10px] text-slate-500 truncate" title={`SHA-256: ${item.sha256}`}>
                    sha: {item.sha256.slice(0, 8)}...
                  </div>
                )}
              </div>

              {/* Vote bar rendered only when leaderboard responds */}
              {hasLeaderboard && (
                <VoteBar votes={item.votes} maxVotes={maxVotes} />
              )}
            </div>
          </motion.div>
        );
      })}

      {selectedItem && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Artwork by ${selectedItem.nickname}`}
          onClick={() => setSelectedItem(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSelectedItem(null);
          }}
          tabIndex={-1}
        >
          <button
            type="button"
            onClick={() => setSelectedItem(null)}
            aria-label="Close artwork viewer"
            className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/60 p-3 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-pink-400"
          >
            <X className="h-6 w-6" />
          </button>
          <ArtworkImage
            item={selectedItem}
            loading="eager"
          className="max-h-full max-w-full object-contain bg-white cursor-zoom-out"
            onClick={(event) => event.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white">
            {selectedItem.nickname}
          </div>
        </div>
      )}
    </div>
  );
};
