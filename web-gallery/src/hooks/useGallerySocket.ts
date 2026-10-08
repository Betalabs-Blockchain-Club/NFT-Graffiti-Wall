import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { GalleryItem, LeaderboardEntry } from "../types";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
export const WS_BASE = import.meta.env.VITE_WS_URL || API_BASE;
export const IPFS_GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY || "https://ipfs.io/ipfs").replace(/\/+$/, "");

export function artworkImageUrl(item: GalleryItem): string {
  if (item.imageUrl.startsWith("ipfs://")) return `${IPFS_GATEWAY}/${item.imageUrl.slice(7)}`;
  if (item.imageUrl) return item.imageUrl;
  return item.imageCID ? `${IPFS_GATEWAY}/${item.imageCID}` : "";
}

export interface UseGallerySocketResult {
  items: GalleryItem[];
  isConnected: boolean;
  latestNewItem: GalleryItem | null;
  clearLatestNewItem: () => void;
  hasLeaderboard: boolean;
  refresh: () => Promise<void>;
}

export function useGallerySocket(): UseGallerySocketResult {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latestNewItem, setLatestNewItem] = useState<GalleryItem | null>(null);
  const [hasLeaderboard, setHasLeaderboard] = useState<boolean>(false);

  // Keep track of hidden IDs so fallback REST polls never revive a hidden item
  const hiddenIdsRef = useRef<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  const clearLatestNewItem = useCallback(() => {
    setLatestNewItem(null);
  }, []);

  // Fetch optional leaderboard
  const fetchLeaderboard = useCallback(async (): Promise<Record<string, number> | null> => {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        setHasLeaderboard(false);
        return null;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        setHasLeaderboard(false);
        return null;
      }
      setHasLeaderboard(true);
      const voteMap: Record<string, number> = {};
      for (const entry of data as LeaderboardEntry[]) {
        if (entry.artworkId) {
          voteMap[entry.artworkId] = entry.votes ?? 0;
        }
      }
      return voteMap;
    } catch {
      setHasLeaderboard(false);
      return null;
    }
  }, []);

  // Backfill items from REST API
  const backfill = useCallback(async () => {
    try {
      const [galleryRes, voteMap] = await Promise.all([
        fetch(`${API_BASE}/api/gallery?status=approved`, {
          headers: { Accept: "application/json" },
        }).then((r) => (r.ok ? r.json() : null)),
        fetchLeaderboard(),
      ]);

      const galleryItems = Array.isArray(galleryRes) ? galleryRes : galleryRes?.items;
      if (Array.isArray(galleryItems)) {
        const approvedItems: GalleryItem[] = galleryItems.filter(
          (item: GalleryItem) =>
            item &&
            item.id &&
            item.status === "approved" &&
            !hiddenIdsRef.current.has(item.id)
        );

        setItems((prev) => {
          // Merge keeping order: newer items at the beginning
          const itemMap = new Map<string, GalleryItem>();

          // Existing items first
          for (const item of prev) {
            if (!hiddenIdsRef.current.has(item.id)) {
              itemMap.set(item.id, item);
            }
          }

          // Merge fetched items
          for (const item of approvedItems) {
            if (!hiddenIdsRef.current.has(item.id)) {
              const existing = itemMap.get(item.id);
              const votes = voteMap?.[item.id] ?? existing?.votes ?? item.votes ?? 0;
              itemMap.set(item.id, {
                ...item,
                votes,
              });
            }
          }

          // Return array sorted by createdAt descending
          return Array.from(itemMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
      }
    } catch (err) {
      console.warn("[web-gallery] REST backfill error:", err);
    }
  }, [fetchLeaderboard]);

  useEffect(() => {
    // Initial backfill
    backfill();

    // Socket.IO namespace /gallery
    // Remove trailing slash from WS_BASE if present
    const cleanWsBase = WS_BASE.replace(/\/+$/, "");
    const socket = io(`${cleanWsBase}/gallery`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      // Re-backfill on connect/reconnect to catch up on any missed items
      backfill();
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("connect_error", () => {
      setIsConnected(false);
    });

    // Handle new artwork event
    socket.on("new", (newItem: GalleryItem) => {
      if (!newItem || !newItem.id || hiddenIdsRef.current.has(newItem.id)) {
        return;
      }

      setItems((prev) => {
        // Deduplicate by ID
        const exists = prev.some((it) => it.id === newItem.id);
        if (exists) {
          return prev.map((it) => (it.id === newItem.id ? { ...it, ...newItem } : it));
        }
        return [newItem, ...prev];
      });

      // Trigger G2 NewArtToast / confetti spotlight
      setLatestNewItem(newItem);
    });

    // Handle hide event (instant removal with zero flicker)
    socket.on("hide", ({ id }: { id: string }) => {
      if (!id) return;
      hiddenIdsRef.current.add(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setLatestNewItem((current) => (current?.id === id ? null : current));
    });

    // REST poll fallback every 10s
    const pollInterval = setInterval(() => {
      backfill();
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [backfill]);

  return {
    items,
    isConnected,
    latestNewItem,
    clearLatestNewItem,
    hasLeaderboard,
    refresh: backfill,
  };
}
