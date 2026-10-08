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
  useEffect(() => setCandidateIndex(0), [candidates]);

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
