import React, { useState } from "react";
import { useGallerySocket } from "../hooks/useGallerySocket";
import { GalleryGrid } from "../components/GalleryGrid";
import { NewArtToast } from "../components/NewArtToast";
import { AttractOverlay } from "../components/AttractOverlay";
import { Sparkles, Radio, Tv, Layers, RefreshCw } from "lucide-react";

export const Wall: React.FC = () => {
  const {
    items,
    isConnected,
    latestNewItem,
    clearLatestNewItem,
    hasLeaderboard,
    refresh,
  } = useGallerySocket();

  const [showAttract, setShowAttract] = useState<boolean>(false);
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(255,0,127,0.5)]">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300">
                NFT Graffiti Wall
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
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
            onClick={() => setShowAttract((prev) => !prev)}
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
            onDismiss={() => setShowAttract(false)}
            isDismissable={true}
          />
        ) : items.length === 0 ? (
          <AttractOverlay isDismissable={false} />
        ) : (
          <div className="flex-grow overflow-y-auto">
            <GalleryGrid items={items} hasLeaderboard={hasLeaderboard} />
          </div>
        )}
      </main>

      {/* Confetti + Zoom-In Spotlight for New Art Drops */}
      <NewArtToast item={latestNewItem} onDismiss={clearLatestNewItem} />
    </div>
  );
};
