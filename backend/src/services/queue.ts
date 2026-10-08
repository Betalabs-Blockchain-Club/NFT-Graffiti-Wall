export type JobStage = "hashing" | "uploading" | "minting" | "confirmed" | "failed";
export interface MintJob {
	jobId: string;
	stage: JobStage;
	tokenId?: number;
	txHash?: string;
	imageCID?: string;
	metadataCID?: string;
	retry?: number;
	error?: string;
}

export type MintInput = {
	jobId: string;
	pngBytes: Uint8Array;
	nickname: string;
	clientHash: string;
};

type QueueOptions = {
	ipfs: {
		pinImage(bytes: Uint8Array): Promise<string>;
		pinMetadata(metadata: Record<string, unknown>): Promise<string>;
	};
	chain: {
		mint(nickname: string, imageCID: string, sha256Hex: string, metadataURI: string): Promise<{
			tokenId: number;
			txHash: string;
			blockNumber: number;
		}>;
	};
	storage?: {
		setMinted?(data: { id: string; tokenId: number; txHash: string; blockNumber: number; imageCID: string; metadataCID: string }): unknown | Promise<unknown>;
		setStatus?(id: string, status: string): unknown | Promise<unknown>;
	};
	realtime?: { onJob?(job: MintJob): void };
	moderationMode?: "display_after_approve" | "off";
	concurrency?: number;
	maxRetries?: number;
	retryDelayMs?: number;
};

class PermanentQueueError extends Error {}

async function sha256(bytes: Uint8Array): Promise<string> {
	if (!globalThis.crypto?.subtle) throw new Error("WebCrypto is required for queue hashing");
	const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createMintQueue(options: QueueOptions) {
	const jobs = new Map<string, MintJob>();
	const inputs = new Map<string, MintInput>();
	const pending: string[] = [];
	const running = new Set<string>();
	const concurrency = Math.max(1, options.concurrency ?? 2);
	const maxRetries = Math.max(0, options.maxRetries ?? 3);
	const retryDelayMs = Math.max(0, options.retryDelayMs ?? 500);

	const publish = (job: MintJob) => {
		jobs.set(job.jobId, { ...job });
		options.realtime?.onJob?.({ ...job });
	};

	const setStage = (job: MintJob, stage: JobStage, extra: Partial<MintJob> = {}) => {
		publish({ ...job, ...extra, stage, error: undefined });
	};

	const process = async (input: MintInput, job: MintJob) => {
		const bytesHash = await sha256(input.pngBytes);
		if (bytesHash !== input.clientHash.replace(/^0x/, "").toLowerCase()) {
			throw new PermanentQueueError("client hash does not match uploaded bytes");
		}

		setStage(job, "uploading");
		const imageCID = await options.ipfs.pinImage(input.pngBytes);
		const metadataCID = await options.ipfs.pinMetadata({
			name: `Blockchain Art ${input.jobId}`,
			description: `Created by ${input.nickname}`,
			image: `ipfs://${imageCID}`,
			attributes: [
				{ trait_type: "Creator", value: input.nickname },
				{ trait_type: "SHA-256", value: bytesHash },
				{ trait_type: "Event", value: "TechFest 2026" }
			]
		});

		setStage(job, "minting", { imageCID, metadataCID });
		const result = await options.chain.mint(input.nickname, imageCID, bytesHash, `ipfs://${metadataCID}`);
		const status = options.moderationMode === "off" ? "approved" : "minted";
		const completed: MintJob = {
			...job,
			stage: "confirmed",
			imageCID,
			metadataCID,
			tokenId: result.tokenId,
			txHash: result.txHash,
			retry: job.retry,
			error: undefined
		};
		publish(completed);
		await options.storage?.setMinted?.({
			id: input.jobId,
			tokenId: result.tokenId,
			txHash: result.txHash,
			blockNumber: result.blockNumber,
			imageCID,
			metadataCID
		});
		await options.storage?.setStatus?.(input.jobId, status);
	};

	const run = async (input: MintInput) => {
		const job = jobs.get(input.jobId) ?? { jobId: input.jobId, stage: "hashing" as const, retry: 0 };
		jobs.set(input.jobId, job);
		for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
			const current = { ...job, retry: attempt };
			publish(current);
			try {
				await process(input, current);
				return;
			} catch (error) {
				if (error instanceof PermanentQueueError || attempt === maxRetries) {
					publish({ ...current, stage: "failed", retry: attempt, error: error instanceof Error ? error.message : String(error) });
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
			}
		}
	};

	const drain = () => {
		while (running.size < concurrency && pending.length > 0) {
			const jobId = pending.shift()!;
			const input = inputs.get(jobId)!;
			running.add(jobId);
			void run(input).finally(() => {
				running.delete(jobId);
				inputs.delete(jobId);
				drain();
			});
		}
	};

	return {
		enqueue(input: MintInput): MintJob {
			const existing = jobs.get(input.jobId);
			if (existing) return { ...existing };
			inputs.set(input.jobId, input);
			const job = { jobId: input.jobId, stage: "hashing" as const, retry: 0 };
			jobs.set(input.jobId, job);
			pending.push(input.jobId);
			drain();
			return { ...job };
		},
		getStatus(jobId: string): MintJob | undefined {
			const job = jobs.get(jobId);
			return job ? { ...job } : undefined;
		},
		getQueueDepth: () => pending.length + running.size,
		close: () => {
			pending.length = 0;
			inputs.clear();
		}
	};
}
