import { useEffect, useState } from "react";
import { artworkImageCandidates } from "../lib/api";
import type { GalleryItem } from "../types";

export function ArtworkPreview({ item }: { item: GalleryItem }) {
  const candidates = artworkImageCandidates(item);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [item.imageUrl, item.imageCID]);
  if (!candidates[index]) return <span className="preview-fallback">Artwork preview unavailable</span>;
  return <img src={candidates[index]} alt={`Artwork submitted by ${item.nickname}`} loading="lazy" onError={() => setIndex((current) => current + 1)} />;
}
