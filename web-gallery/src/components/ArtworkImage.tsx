import React, { useEffect, useMemo, useState } from "react";
import { artworkImageCandidates } from "../hooks/useGallerySocket";
import { GalleryItem } from "../types";

interface ArtworkImageProps {
  item: GalleryItem;
  className?: string;
  loading?: "eager" | "lazy";
  onClick?: React.MouseEventHandler<HTMLImageElement>;
}

export const ArtworkImage: React.FC<ArtworkImageProps> = ({ item, className, loading = "lazy", onClick }) => {
  const candidates = useMemo(() => artworkImageCandidates(item), [item.imageUrl, item.imageCID]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  useEffect(() => {
    setCandidateIndex(0);
  }, [candidates]);

  // Newly pinned IPFS content can take a short time to become available on
  // public gateways. Keep retrying so a fresh gallery card doesn't need a reload.
  useEffect(() => {
    if (!candidates.length || candidateIndex < candidates.length) return;
    const retryTimer = window.setTimeout(() => setCandidateIndex(0), 2500);
    return () => window.clearTimeout(retryTimer);
  }, [candidateIndex, candidates.length]);

  if (!candidates[candidateIndex]) {
    return (
      <div className={`flex items-center justify-center bg-[#131728] text-sm text-slate-400 ${className ?? ""}`}>
        Artwork unavailable
      </div>
    );
  }

  return (
    <img
      src={candidates[candidateIndex]}
      alt={`Artwork by ${item.nickname}`}
      loading={loading}
      decoding="async"
      className={className}
      onClick={onClick}
      onError={() => setCandidateIndex((index) => index + 1)}
    />
  );
};
