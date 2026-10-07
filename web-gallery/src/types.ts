export type ArtworkStatus = "pending" | "minted" | "approved" | "hidden";

export interface GalleryItem {
  id: string; // artwork / job id
  tokenId?: number;
  nickname: string;
  imageCID: string;
  imageUrl: string;
  sha256: string;
  status: ArtworkStatus;
  createdAt: string;
  votes?: number;
}

export interface LeaderboardEntry {
  id: string;
  tokenId?: number;
  nickname?: string;
  votes: number;
}
