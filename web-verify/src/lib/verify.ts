import { Contract, JsonRpcProvider, ZeroHash, isAddress } from "ethers";
import { graffitiWallAbi } from "../abi";

export type VerificationStage = "chain" | "image" | "hash";
export interface VerifyConfig { rpcUrl: string; contractAddress: string; ipfsGateways: string[]; chainId?: string; explorerUrl?: string; }
export interface VerificationResult {
  tokenId: bigint; nickname: string; ipfsCID: string; timestamp: bigint; creator: string;
  onChainHash: string; recomputedHash: string; verified: boolean; imageUrl: string; explorerUrl?: string;
}
export class VerificationError extends Error {
  constructor(public readonly kind: "configuration" | "not-found" | "chain" | "gateway", message: string) {
    super(message); this.name = "VerificationError";
  }
}
export function parseGateways(value: string | undefined): string[] {
  return (value ?? "").split(",").map((gateway) => gateway.trim().replace(/\/+$/, "")).filter(Boolean);
}
export function buildGatewayUrls(cid: string, gateways: string[]): string[] {
  return gateways.map((gateway) => `${gateway.replace(/\/+$/, "")}/${encodeURIComponent(cid)}`);
}
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function fetchImageWithFallback(cid: string, gateways: string[], fetcher: typeof fetch = fetch): Promise<{ bytes: ArrayBuffer; imageUrl: string }> {
  const urls = buildGatewayUrls(cid, gateways);
  if (!urls.length) throw new VerificationError("configuration", "No IPFS gateway is configured.");
  const failures: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetcher(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) { failures.push(`${new URL(url).host}: HTTP ${response.status}`); continue; }
      return { bytes: await response.arrayBuffer(), imageUrl: url };
    } catch (error) {
      failures.push(`${new URL(url).host}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  throw new VerificationError("gateway", `Artwork could not be loaded from IPFS (${failures.join("; ")}).`);
}
export async function verifyToken(tokenIdText: string, config: VerifyConfig, onStage?: (stage: VerificationStage) => void): Promise<VerificationResult> {
  if (!/^\d+$/.test(tokenIdText)) throw new VerificationError("not-found", "Token ID must be a positive whole number.");
  if (!config.rpcUrl || !isAddress(config.contractAddress)) throw new VerificationError("configuration", "The verification site is missing a valid RPC URL or contract address.");
  const tokenId = BigInt(tokenIdText);
  onStage?.("chain");
  let artwork: { creator: string; nickname: string; ipfsCID: string; artworkHash: string; timestamp: bigint };
  try {
    const provider = new JsonRpcProvider(config.rpcUrl);
    if (config.chainId && (await provider.getNetwork()).chainId !== BigInt(config.chainId)) {
      throw new VerificationError("chain", "The configured RPC endpoint is connected to the wrong chain.");
    }
    const contract = new Contract(config.contractAddress, graffitiWallAbi, provider);
    artwork = await contract.artworks(tokenId);
  } catch { throw new VerificationError("chain", "The artwork could not be read from the configured blockchain."); }
  if (!artwork.ipfsCID || artwork.artworkHash === ZeroHash) throw new VerificationError("not-found", `Token #${tokenId} was not found on this Graffiti Wall contract.`);
  onStage?.("image");
  const { bytes, imageUrl } = await fetchImageWithFallback(artwork.ipfsCID, config.ipfsGateways);
  onStage?.("hash");
  const recomputedHash = `0x${await sha256Hex(bytes)}`;
  const explorerUrl = config.explorerUrl ? `${config.explorerUrl.replace(/\/+$/, "")}/address/${config.contractAddress}` : undefined;
  return { tokenId, nickname: artwork.nickname, ipfsCID: artwork.ipfsCID, timestamp: artwork.timestamp, creator: artwork.creator,
    onChainHash: artwork.artworkHash, recomputedHash, verified: recomputedHash.toLowerCase() === artwork.artworkHash.toLowerCase(), imageUrl, explorerUrl };
}
