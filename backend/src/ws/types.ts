import type { GalleryItem, MintJob } from "../../../shared/src/types/index.js";

export interface RealtimeOptions {
  allowedOrigin: string | string[];
}

export interface Realtime {
  emitNew(item: GalleryItem): void;
  emitHide(id: string): void;
  emitLikeCount(artworkId: string, likes: number): void;
  emitJob(jobId: string, job: MintJob): void;
  close(): Promise<void>;
}

export interface GalleryEvents {
  new: (item: GalleryItem) => void;
  hide: (payload: { id: string }) => void;
  "like-count": (payload: { artworkId: string; likes: number }) => void;
}

export interface StatusEvents {
  job: (job: MintJob) => void;
}

export interface StatusSubscriptions {
  subscribe: (jobId: string) => void;
}
