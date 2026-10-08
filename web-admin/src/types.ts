export type GalleryStatus = "pending" | "minted" | "approved" | "hidden";

// Local mirror of the frozen shared GalleryItem contract.
export interface GalleryItem {
  id: string;
  tokenId?: number;
  nickname: string;
  imageCID: string;
  imageUrl: string;
  sha256: string;
  status: GalleryStatus;
  createdAt: string;
}

export type QueueStatus = "pending" | "minted" | "hidden";
