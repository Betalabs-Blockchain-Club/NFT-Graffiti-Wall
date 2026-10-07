import type { GalleryItem, MintJob } from "../../../shared/src/types/index.js";

export interface RealtimeOptions {
  allowedOrigin: string | string[];
}

export interface Realtime {
  emitNew(item: GalleryItem): void;
  emitHide(id: string): void;
  emitJob(jobId: string, job: MintJob): void;
  close(): Promise<void>;
}

export interface GalleryEvents {
  new: (item: GalleryItem) => void;
  hide: (payload: { id: string }) => void;
}

export interface StatusEvents {
  job: (job: MintJob) => void;
}

export interface StatusSubscriptions {
  subscribe: (jobId: string) => void;
}
