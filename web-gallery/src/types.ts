import type { LeaderboardEntry } from "@graffiti/shared/api-client";
import type { GalleryItem as ApiGalleryItem } from "@graffiti/shared/types";

export type GalleryItem = ApiGalleryItem & { votes?: number };
export type { LeaderboardEntry };
