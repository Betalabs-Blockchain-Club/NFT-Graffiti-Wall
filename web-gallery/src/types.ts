import type { LeaderboardEntry } from "@graffiti/shared/api-client";
import type { GalleryItem as ApiGalleryItem } from "@graffiti/shared/types";

export type GalleryItem = ApiGalleryItem & { likes?: number; likedByMe?: boolean };
export type { LeaderboardEntry };
