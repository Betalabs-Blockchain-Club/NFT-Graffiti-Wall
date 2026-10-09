import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { GalleryItem } from "../types";
import { fetchLikeSummaries, getAnonymousBrowserId, setArtworkLike } from "../lib/likes";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
export const WS_BASE = import.meta.env.VITE_WS_URL || API_BASE;
export const IPFS_GATEWAY = (import.meta.env.VITE_IPFS_GATEWAY || "https://ipfs.io/ipfs").replace(/\/+$/, "");

function sortByLikes(items: GalleryItem[]): GalleryItem[] {
  return [...items].sort((a, b) =>
    (b.likes ?? 0) - (a.likes ?? 0) ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function gatewayImageUrl(cid: string, gateway = IPFS_GATEWAY): string {
  const base = gateway.replace(/\/+$/, "");
  return `${base.endsWith("/ipfs") ? base : `${base}/ipfs`}/${cid}`;
}

export function artworkImageUrl(item: GalleryItem): string {
  if (item.imageUrl.startsWith("ipfs://")) return gatewayImageUrl(item.imageUrl.slice(7));
  if (item.imageUrl) {
    // Mock IPFS URLs are API-relative; resolve them against the backend, not Vite.
    if (item.imageUrl.startsWith("/")) return `${API_BASE.replace(/\/+$/, "")}${item.imageUrl}`;
    return item.imageUrl;
  }
  return item.imageCID ? gatewayImageUrl(item.imageCID) : "";
}

export function artworkImageCandidates(item: GalleryItem): string[] {
  if (item.imageUrl && !item.imageUrl.startsWith("ipfs://")) {
    return [artworkImageUrl(item)].filter(Boolean);
  }

  const ipfsUri = item.imageUrl.startsWith("ipfs://") ? item.imageUrl.slice(7) : item.imageCID;
  if (!ipfsUri) return [artworkImageUrl(item)].filter(Boolean);

  const cidPath = ipfsUri.replace(/^ipfs\//, "");
  return [...new Set([
    gatewayImageUrl(cidPath),
    gatewayImageUrl(cidPath, "https://ipfs.io"),
    gatewayImageUrl(cidPath, "https://dweb.link")
  ])];
}

export interface UseGallerySocketResult {
  items: GalleryItem[];
  isConnected: boolean;
  latestNewItem: GalleryItem | null;
  clearLatestNewItem: () => void;
  likesAvailable: boolean;
  toggleLike: (artworkId: string, liked: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useGallerySocket(): UseGallerySocketResult {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latestNewItem, setLatestNewItem] = useState<GalleryItem | null>(null);
  const [likesAvailable, setLikesAvailable] = useState<boolean>(false);
  const [browserId] = useState(getAnonymousBrowserId);

  // Keep track of hidden IDs so fallback REST polls never revive a hidden item
  const hiddenIdsRef = useRef<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  const clearLatestNewItem = useCallback(() => {
    setLatestNewItem(null);
  }, []);

  // Backfill items from REST API
  const backfill = useCallback(async () => {
    try {
      const [galleryRes, likeSummaries] = await Promise.all([
        fetch(`${API_BASE}/api/gallery?status=approved`, {
          headers: { Accept: "application/json" },
        }).then((r) => (r.ok ? r.json() : null)),
        fetchLikeSummaries(browserId).catch(() => null),
      ]);
      setLikesAvailable(likeSummaries !== null);
      const likeMap = new Map((likeSummaries ?? []).map((summary) => [summary.artworkId, summary]));

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
              const likeSummary = likeMap.get(item.id);
              itemMap.set(item.id, {
                ...item,
                likes: likeSummaries !== null ? likeSummary?.likes : existing?.likes,
                likedByMe: likeSummaries !== null ? (likeSummary?.likedByMe ?? false) : (existing?.likedByMe ?? false),
              });
            }
          }

          return sortByLikes(Array.from(itemMap.values()));
        });
      }
    } catch (err) {
      console.warn("[web-gallery] REST backfill error:", err);
    }
  }, [browserId]);

  const toggleLike = useCallback(async (artworkId: string, liked: boolean) => {
    const update = await setArtworkLike(artworkId, browserId, liked);
    setItems((current) => sortByLikes(current.map((item) => item.id === artworkId
      ? { ...item, likes: update.likes, likedByMe: update.likedByMe }
      : item)));
  }, [browserId]);

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
      if (!newItem || !newItem.id) return;
      // A "new" event is also sent when staff restores hidden artwork.
      hiddenIdsRef.current.delete(newItem.id);

      setItems((prev) => {
        // Deduplicate by ID
        const exists = prev.some((it) => it.id === newItem.id);
        if (exists) {
          return sortByLikes(prev.map((it) => (it.id === newItem.id ? { ...it, ...newItem, likes: it.likes, likedByMe: it.likedByMe } : it)));
        }
        return sortByLikes([{ ...newItem, likes: undefined, likedByMe: false }, ...prev]);
      });

      // Trigger G2 NewArtToast / confetti spotlight
      setLatestNewItem(newItem);
      void backfill();
    });

    // Handle hide event (instant removal with zero flicker)
    socket.on("hide", ({ id }: { id: string }) => {
      if (!id) return;
      hiddenIdsRef.current.add(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setLatestNewItem((current) => (current?.id === id ? null : current));
    });

    socket.on("like-count", ({ artworkId, likes }: { artworkId: string; likes: number }) => {
      setItems((prev) => sortByLikes(prev.map((item) => item.id === artworkId ? { ...item, likes } : item)));
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
    likesAvailable,
    toggleLike,
    refresh: backfill,
  };
}
