export type JobStage = "hashing" | "uploading" | "ready" | "minting" | "confirmed" | "failed";
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

export type MintInput = { jobId: string; pngBytes: Uint8Array; nickname: string; clientHash: string };
type PreparedArtwork = { nickname: string; sha256: string; imageCID: string; metadataCID: string };
type QueueOptions = {
	ipfs: { pinImage(bytes: Uint8Array): Promise<string>; pinMetadata(metadata: Record<string, unknown>): Promise<string> };
	chain: { mint(nickname: string, imageCID: string, sha256Hex: string, metadataURI: string): Promise<{ tokenId: number; txHash: string; blockNumber: number }> };
	storage?: {
		setPinned?(id: string, imageCID: string, metadataCID: string): unknown | Promise<unknown>;
		setMinted?(data: { id: string; tokenId: number; txHash: string; blockNumber: number; imageCID: string; metadataCID: string }): unknown | Promise<unknown>;
		setStatus?(id: string, status: string): unknown | Promise<unknown>;
	};
	realtime?: { onJob?(job: MintJob): void };
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
	const prepared = new Map<string, PreparedArtwork>();
	const prepareTasks = new Map<string, Promise<void>>();
	const mintTasks = new Map<string, Promise<MintJob>>();
	const pending: string[] = [];
	const running = new Set<string>();
	const cancelled = new Set<string>();
	const concurrency = Math.max(1, options.concurrency ?? 2);
	const maxRetries = Math.max(0, options.maxRetries ?? 3);
	const retryDelayMs = Math.max(0, options.retryDelayMs ?? 500);

	const publish = (job: MintJob) => {
		if (cancelled.has(job.jobId)) return;
		jobs.set(job.jobId, { ...job });
		options.realtime?.onJob?.({ ...job });
	};
	const setStage = (job: MintJob, stage: JobStage, extra: Partial<MintJob> = {}) => {
		publish({ ...job, ...extra, stage, error: undefined });
	};

	const prepare = async (input: MintInput, initialJob?: MintJob): Promise<void> => {
		if (cancelled.has(input.jobId)) return;
		const job = initialJob ?? { jobId: input.jobId, stage: "hashing" as const, retry: 0 };
		try {
			const bytesHash = await sha256(input.pngBytes);
			if (cancelled.has(input.jobId)) return;
			if (bytesHash !== input.clientHash.replace(/^0x/, "").toLowerCase()) {
				throw new PermanentQueueError("client hash does not match uploaded bytes");
			}
			setStage(job, "uploading");
			let imageCID = job.imageCID;
			let metadataCID = job.metadataCID;
			if (!imageCID || !metadataCID) {
				imageCID = await options.ipfs.pinImage(input.pngBytes);
				if (cancelled.has(input.jobId)) return;
				metadataCID = await options.ipfs.pinMetadata({
					name: `Blockchain Art ${input.jobId}`,
					description: `Created by ${input.nickname}`,
					image: `ipfs://${imageCID}`,
					attributes: [
						{ trait_type: "Creator", value: input.nickname },
						{ trait_type: "SHA-256", value: bytesHash },
						{ trait_type: "Event", value: "TechFest 2026" }
					]
				});
				if (cancelled.has(input.jobId)) return;
				await options.storage?.setPinned?.(input.jobId, imageCID, metadataCID);
			}
			if (cancelled.has(input.jobId)) return;
			prepared.set(input.jobId, { nickname: input.nickname, sha256: bytesHash, imageCID, metadataCID });
			setStage(job, "ready", { imageCID, metadataCID, retry: job.retry ?? 0 });
		} catch (error) {
			if (!cancelled.has(input.jobId)) publish({ ...job, stage: "failed", error: error instanceof Error ? error.message : String(error) });
		}
	};

	const prepareWithRetries = (input: MintInput, baseJob?: MintJob): Promise<void> => {
		const existing = prepareTasks.get(input.jobId);
		if (existing) return existing;
		const task = (async () => {
			const prior = baseJob ?? jobs.get(input.jobId) ?? { jobId: input.jobId, stage: "hashing" as const, retry: 0 };
			for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
				if (cancelled.has(input.jobId)) return;
				const current = { ...prior, stage: "hashing" as const, retry: attempt };
				publish(current);
				await prepare(input, current);
				if (cancelled.has(input.jobId)) return;
				if (jobs.get(input.jobId)?.stage !== "failed") return;
				if (jobs.get(input.jobId)?.error?.includes("client hash does not match")) return;
				if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
			}
		})();
		prepareTasks.set(input.jobId, task);
		void task.finally(() => prepareTasks.delete(input.jobId));
		return task;
	};

	const drain = () => {
		while (running.size < concurrency && pending.length > 0) {
			const jobId = pending.shift()!;
			const input = inputs.get(jobId)!;
			running.add(jobId);
			void prepareWithRetries(input).finally(() => {
				running.delete(jobId);
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
			if (job) return { ...job };
			return undefined;
		},
		async retryPin(jobId: string): Promise<MintJob> {
			const input = inputs.get(jobId);
			if (!input) throw new Error("The image bytes are no longer available; ask the visitor to submit again.");
			if (jobs.get(jobId)?.stage !== "failed") throw new Error("Only failed IPFS uploads can be retried.");
			await prepareWithRetries(input, { jobId, stage: "hashing", retry: 0 });
			return { ...jobs.get(jobId)! };
		},
		cancel(jobId: string): boolean {
			const current = jobs.get(jobId);
			if (current?.stage === "minting" || current?.stage === "confirmed") return false;
			cancelled.add(jobId);
			for (let index = pending.length - 1; index >= 0; index -= 1) {
				if (pending[index] === jobId) pending.splice(index, 1);
			}
			jobs.delete(jobId);
			inputs.delete(jobId);
			prepared.delete(jobId);
			return true;
		},
		async mint(jobId: string): Promise<MintJob> {
			const existingTask = mintTasks.get(jobId);
			if (existingTask) return existingTask;
			const current = this.getStatus(jobId);
			if (current?.stage === "confirmed") return current;
			const details = prepared.get(jobId);
			if (!details) throw new Error("Pinned artwork details are unavailable.");
			if (current?.stage !== "ready" && current?.stage !== "failed") throw new Error("Artwork is not ready to mint yet.");
			const readyJob = current.stage === "failed" ? { ...current, stage: "ready" as const } : current;
			const task = (async () => {
				setStage(readyJob, "minting");
				try {
					const result = await options.chain.mint(details.nickname, details.imageCID, details.sha256, `ipfs://${details.metadataCID}`);
					await options.storage?.setMinted?.({ id: jobId, ...result, imageCID: details.imageCID, metadataCID: details.metadataCID });
					await options.storage?.setStatus?.(jobId, "approved");
					const completed: MintJob = {
						...readyJob, stage: "confirmed", tokenId: result.tokenId, txHash: result.txHash,
						imageCID: details.imageCID, metadataCID: details.metadataCID, error: undefined
					};
					publish(completed);
					return completed;
				} catch (error) {
					const failed: MintJob = { ...readyJob, stage: "failed", error: error instanceof Error ? error.message : String(error) };
					publish(failed);
					throw error;
				}
			})();
			mintTasks.set(jobId, task);
			try { return await task; }
			finally { mintTasks.delete(jobId); }
		},
		getQueueDepth: () => pending.length + running.size + mintTasks.size,
		close: () => {
			pending.length = 0;
			inputs.clear();
			cancelled.clear();
		}
	};
}
