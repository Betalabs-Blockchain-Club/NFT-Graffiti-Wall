// services/queue.ts — FIFO mint queue with retry/backoff.
// Job: { jobId, pngBytes: Buffer, nickname: string, clientHash: string }
// Stages: hashing -> uploading -> minting -> confirmed | failed
// TODO: implement with p-queue or BullMQ, concurrency 2, 3 retries exp backoff.
export type JobStage = "hashing" | "uploading" | "minting" | "confirmed" | "failed";
export interface MintJob { jobId: string; stage: JobStage; tokenId?: number; txHash?: string; error?: string; }
