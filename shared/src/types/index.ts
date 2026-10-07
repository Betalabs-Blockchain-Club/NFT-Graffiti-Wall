export type JobStage = "hashing" | "uploading" | "minting" | "confirmed" | "failed";
export type ArtworkStatus = "pending" | "minted" | "approved" | "hidden" | "failed";

export interface Artwork {
  id: string; // jobId
  tokenId: number | null;
  nickname: string;
  imageCID: string | null;
  metadataCID: string | null;
  sha256: string; // hex, no 0x
  txHash: string | null;
  blockNumber: number | null;
  status: ArtworkStatus;
  createdAt: string;
}

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

export interface GalleryItem {
  id: string;
  tokenId?: number;
  nickname: string;
  imageCID: string;
  imageUrl: string;
  sha256: string;
  status: "pending" | "minted" | "approved" | "hidden";
  createdAt: string;
}

export interface VerifyResult {
  tokenId: number;
  verified: boolean;
  onChainHash: string;
  recomputedHash: string;
  nickname: string;
  ipfsCID: string;
}
