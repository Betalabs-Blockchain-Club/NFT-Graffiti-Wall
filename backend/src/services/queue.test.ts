import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createMintQueue, type MintInput, type MintJob } from "./queue.js";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const clientHash = createHash("sha256").update(pngBytes).digest("hex");

const input: MintInput = {
	jobId: "job-1",
	pngBytes,
	nickname: "Pixel Fox",
	clientHash
};

function waitFor(queue: ReturnType<typeof createMintQueue>, predicate: (job: MintJob | undefined) => boolean) {
	return new Promise<MintJob>((resolve, reject) => {
		const deadline = Date.now() + 1_000;
		const check = () => {
			const job = queue.getStatus(input.jobId);
			if (job && predicate(job)) {
				resolve(job);
				return;
			}
			if (Date.now() >= deadline) {
				reject(new Error(`Timed out waiting for queue status: ${JSON.stringify(job)}`));
				return;
			}
			setTimeout(check, 5);
		};
		check();
	});
}

function options(overrides: Partial<Parameters<typeof createMintQueue>[0]> = {}) {
	return {
		ipfs: {
			pinImage: vi.fn().mockResolvedValue("bafy-image"),
			pinMetadata: vi.fn().mockResolvedValue("bafy-metadata")
		},
		chain: {
			mint: vi.fn().mockResolvedValue({ tokenId: 7, txHash: "0xtx", blockNumber: 12 })
		},
		retryDelayMs: 1,
		...overrides
	};
}

describe("mint queue", () => {
	it("pins a valid PNG and waits for an admin mint", async () => {
		const storage = { setMinted: vi.fn(), setStatus: vi.fn() };
		const realtime = { onJob: vi.fn() };
		const queue = createMintQueue({ ...options(), storage, realtime });

		queue.enqueue(input);
		const prepared = await waitFor(queue, (value) => value?.stage === "ready");
		expect(prepared).toMatchObject({ stage: "ready", imageCID: "bafy-image", metadataCID: "bafy-metadata" });
		const job = await queue.mint("job-1");

		expect(job).toMatchObject({ stage: "confirmed", tokenId: 7, txHash: "0xtx", imageCID: "bafy-image", metadataCID: "bafy-metadata" });
		expect(storage.setMinted).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1", blockNumber: 12 }));
		expect(storage.setStatus).toHaveBeenCalledWith("job-1", "approved");
		expect(realtime.onJob).toHaveBeenCalledWith(expect.objectContaining({ stage: "confirmed" }));
		queue.close();
	});

	it("retries a transient IPFS failure and succeeds without losing the job", async () => {
		const pinImage = vi.fn()
			.mockRejectedValueOnce(new Error("temporary IPFS failure"))
			.mockResolvedValue("bafy-image");
		const config = options({ ipfs: { pinImage, pinMetadata: vi.fn().mockResolvedValue("bafy-metadata") } });
		const queue = createMintQueue({ ...config, maxRetries: 1 });

		queue.enqueue(input);
		const job = await waitFor(queue, (value) => value?.stage === "ready");

		expect(job.retry).toBe(1);
		expect(pinImage).toHaveBeenCalledTimes(2);
		await queue.mint("job-1");
		queue.close();
	});

	it("is idempotent by job ID", () => {
		const queue = createMintQueue(options());
		const first = queue.enqueue(input);
		const second = queue.enqueue({ ...input, nickname: "Different Name" });

		expect(second).toEqual(first);
		expect(queue.getQueueDepth()).toBe(1);
		queue.close();
	});

	it("fails permanently when the client hash does not match", async () => {
		const config = options();
		const queue = createMintQueue(config);

		queue.enqueue({ ...input, clientHash: "0".repeat(64) });
		const job = await waitFor(queue, (value) => value?.stage === "failed");

		expect(job.error).toContain("client hash does not match");
		expect(config.ipfs.pinImage).not.toHaveBeenCalled();
		queue.close();
	});
});
