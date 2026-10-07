import type { Artwork, GalleryItem } from "../../../shared/src/types/index.js";

export type { Artwork, ArtworkStatus, GalleryItem } from "../../../shared/src/types/index.js";
export type GalleryStatus = GalleryItem["status"];
export const GALLERY_STATUSES: readonly GalleryStatus[] = ["pending", "minted", "approved", "hidden"];
export interface Config {
  MODERATION_MODE: "display_after_approve" | "mint_after_approve";
  KILL_SWITCH: boolean;
  IPFS_PROVIDER: "pinata" | "kubo";
}
export const DEFAULT_CONFIG: Config = {
  MODERATION_MODE: "display_after_approve", KILL_SWITCH: false, IPFS_PROVIDER: "pinata"
};

export function validConfigEntry(key: string, value: unknown): boolean {
  return key === "MODERATION_MODE" ? value === "display_after_approve" || value === "mint_after_approve"
    : key === "KILL_SWITCH" ? typeof value === "boolean"
    : key === "IPFS_PROVIDER" ? value === "pinata" || value === "kubo" : false;
}

export interface ArtworkRow {
  id: string; token_id: number | null; nickname: string; image_cid: string | null;
  metadata_cid: string | null; sha256: string; tx_hash: string | null;
  block_number: number | null; status: Artwork["status"]; created_at: string;
}

export function artworkFromRow(row: ArtworkRow): Artwork {
  return {
    id: row.id, tokenId: row.token_id, nickname: row.nickname, imageCID: row.image_cid,
    metadataCID: row.metadata_cid, sha256: row.sha256, txHash: row.tx_hash,
    blockNumber: row.block_number, status: row.status, createdAt: row.created_at
  };
}

export function toGalleryItem(artwork: Artwork): GalleryItem {
  if (artwork.status === "failed") throw new Error("Failed artwork is not a GalleryItem");
  const imageCID = artwork.imageCID ?? "";
  return {
    id: artwork.id, ...(artwork.tokenId === null ? {} : { tokenId: artwork.tokenId }),
    nickname: artwork.nickname, imageCID, imageUrl: imageCID ? `ipfs://${imageCID}` : "",
    sha256: artwork.sha256, status: artwork.status, createdAt: artwork.createdAt
  };
}
