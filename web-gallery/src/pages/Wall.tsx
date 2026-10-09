import React, { useEffect, useState } from "react";
import { useGallerySocket } from "../hooks/useGallerySocket";
import { GalleryGrid } from "../components/GalleryGrid";
import { NewArtToast } from "../components/NewArtToast";
import { AttractOverlay } from "../components/AttractOverlay";
import { Radio, Tv, Layers, RefreshCw } from "lucide-react";
import { readGalleryUrlState, writeGalleryUrlState } from "../lib/galleryUrlState";

function useGalleryUrlState() {
  const [state, setState] = useState(() => readGalleryUrlState(new URL(window.location.href)));

  useEffect(() => {
    const restoreFromUrl = () => setState(readGalleryUrlState(new URL(window.location.href)));
    window.addEventListener("popstate", restoreFromUrl);
    return () => window.removeEventListener("popstate", restoreFromUrl);
  }, []);

  const update = (patch: Partial<typeof state>) => {
    const nextUrl = writeGalleryUrlState(new URL(window.location.href), patch);
    if (nextUrl.href !== window.location.href) {
      window.history.pushState(null, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
    setState(readGalleryUrlState(nextUrl));
  };

  return { ...state, update };
}

export const Wall: React.FC = () => {
  const {
    items,
    isConnected,
    latestNewItem,
    clearLatestNewItem,
    likesAvailable,
    toggleLike,
    refresh,
  } = useGallerySocket();

  const { showAttract, selectedArtworkId, update: updateUrlState } = useGalleryUrlState();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f] text-slate-100 select-none">
      {/* Top Bar for 1080p Stage Display */}
      <header className="sticky top-0 z-40 bg-[#0a0c14]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between shadow-xl">
        {/* Title & Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="NFT Graffiti Wall" className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-[0_0_14px_rgba(255,0,127,0.4)]" />
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300">
                NFT Graffiti Wall
              </h1>
              <p className="text-xs md:text-sm text-slate-300 font-mono tracking-widest uppercase">
                Live Expo Broadcast • 1080p
              </p>
            </div>
          </div>
        </div>

        {/* Center Stats */}
        <div className="flex items-center gap-6 font-mono text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141829] border border-slate-800">
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-slate-400">Total Tags:</span>
            <span className="text-white font-bold">{items.length}</span>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
              isConnected
                ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400"
                : "bg-amber-950/40 border-amber-500/40 text-amber-400"
            }`}
          >
            <Radio
              className={`w-3.5 h-3.5 ${
                isConnected ? "animate-pulse text-emerald-400" : ""
              }`}
            />
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              {isConnected ? "Live Socket" : "Polling REST"}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            className="p-2 rounded-xl bg-[#141829] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
            title="Refresh gallery"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`}
            />
          </button>

          <button
            onClick={() => updateUrlState({ showAttract: !showAttract })}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono transition ${
              showAttract
                ? "bg-pink-600 text-white border-pink-500 shadow-[0_0_15px_rgba(255,0,127,0.4)]"
                : "bg-[#141829] text-slate-300 border-slate-800 hover:border-slate-700"
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>{showAttract ? "Close Attract" : "Attract Mode"}</span>
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-grow flex flex-col relative overflow-hidden">
        {showAttract ? (
          <AttractOverlay
            onDismiss={() => updateUrlState({ showAttract: false })}
            isDismissable={true}
          />
        ) : items.length === 0 ? (
          <AttractOverlay isDismissable={false} />
        ) : (
          <div className="flex-grow overflow-y-auto">
            <GalleryGrid
              items={items}
              likesAvailable={likesAvailable}
              onLikeToggle={toggleLike}
              selectedArtworkId={selectedArtworkId}
              onSelectedArtworkChange={(id) => updateUrlState({ selectedArtworkId: id })}
            />
          </div>
        )}
      </main>

      {/* Confetti + Zoom-In Spotlight for New Art Drops */}
      <NewArtToast item={latestNewItem} onDismiss={clearLatestNewItem} />
    </div>
  );
};
