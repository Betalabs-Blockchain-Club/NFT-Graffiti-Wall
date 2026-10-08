import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { ApiError, createApiClient } from "@graffiti/shared/api-client";
import type { MintJob } from "@graffiti/shared/types";
import type { ArtworkExport } from "../components/DrawingCanvas/DrawingCanvas";
import { kioskConfig } from "../lib/config";

export type MintJobState = {
  jobId?: string;
  stage?: MintJob["stage"];
  retry: number;
  retryInfo?: string;
  tokenId?: number;
  txHash?: string;
  imageCID?: string;
  hash: string;
  error?: string;
};

function deviceId(): string {
  const key = "graffiti-wall-device-id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(key, created);
  return created;
}

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return "That drawing could not be accepted. Please try again.";
    if (error.status === 429) return "The kiosk is busy. Please wait a moment and try again.";
    if (error.status === 503) return "Minting is temporarily paused. Please try again shortly.";
    if (error.status === 0) return "The kiosk lost its connection. We will keep checking your job.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong while starting the mint.";
}

function stateFromJob(job: MintJob, hash: string): MintJobState {
  return {
    jobId: job.jobId,
    stage: job.stage,
    retry: job.retry ?? 0,
    retryInfo: job.retry ? `Retry ${job.retry}` : undefined,
    tokenId: job.tokenId,
    txHash: job.txHash,
    imageCID: job.imageCID,
    hash,
    error: job.error
  };
}

export type MintJobController = {
  job: MintJobState;
  isSubmitting: boolean;
  isConnected: boolean;
  submit: () => Promise<void>;
  retry: () => Promise<void>;
};

export function useMintJob(artwork: ArtworkExport | undefined, nickname: string | undefined, submissionId?: string): MintJobController {
  const client = useMemo(() => createApiClient({ baseUrl: kioskConfig.apiUrl }), []);
  const socketRef = useRef<Socket | null>(null);
  const jobIdRef = useRef<string>();
  const submittingRef = useRef(false);
  const fallbackSubmissionIdRef = useRef(globalThis.crypto?.randomUUID?.() ?? `submission-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const idempotencyKey = submissionId ?? fallbackSubmissionIdRef.current;
  const [job, setJob] = useState<MintJobState>({ hash: artwork?.clientHash ?? "", retry: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const applyJob = useCallback((nextJob: MintJob) => {
    jobIdRef.current = nextJob.jobId;
    setJob(stateFromJob(nextJob, artwork?.clientHash ?? ""));
  }, [artwork?.clientHash]);

  const submit = useCallback(async () => {
    if (!artwork || !nickname || submittingRef.current || jobIdRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setJob({ hash: artwork.clientHash, retry: 0 });
    try {
      const response = await client.submitArtwork(artwork.blob, nickname, artwork.clientHash, deviceId(), idempotencyKey);
      jobIdRef.current = response.jobId;
      setJob({ jobId: response.jobId, stage: "hashing", hash: artwork.clientHash, retry: 0 });
    } catch (error) {
      setJob({ hash: artwork.clientHash, retry: 0, error: friendlyError(error) });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [artwork, client, idempotencyKey, nickname]);

  const retry = useCallback(async () => {
    if (job.stage !== "failed") return;
    jobIdRef.current = undefined;
    setJob({ hash: artwork?.clientHash ?? "", retry: 0 });
    await submit();
  }, [artwork?.clientHash, job.stage, submit]);

  useEffect(() => {
    if (!artwork || !jobIdRef.current || job.stage === "confirmed") return;
    const jobId = jobIdRef.current;
    let active = true;
    const socket = io(`${kioskConfig.wsUrl.replace(/\/+$/, "")}/status`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      timeout: 10_000
    });
    socketRef.current = socket;

    const update = (nextJob: MintJob) => {
      if (active && nextJob.jobId === jobId) applyJob(nextJob);
    };
    const poll = async () => {
      try {
        update(await client.getStatus(jobId));
      } catch {
        // Socket updates can continue while the REST endpoint is briefly unavailable.
      }
    };

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("subscribe", jobId);
    });
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("connect_error", () => setIsConnected(false));
    socket.on("job", update);
    void poll();
    const interval = window.setInterval(() => void poll(), 1_000);

    return () => {
      active = false;
      window.clearInterval(interval);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [applyJob, artwork, client, job.jobId]);

  return { job, isSubmitting, isConnected, submit, retry };
}
