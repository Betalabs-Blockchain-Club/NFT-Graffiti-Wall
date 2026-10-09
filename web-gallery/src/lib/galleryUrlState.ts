export interface GalleryUrlState {
  showAttract: boolean;
  selectedArtworkId: string | null;
}

export type GalleryUrlStatePatch = Partial<GalleryUrlState>;

export function readGalleryUrlState(url: URL): GalleryUrlState {
  return {
    showAttract: url.searchParams.get("view") === "attract",
    selectedArtworkId: url.searchParams.get("artwork") || null,
  };
}

export function writeGalleryUrlState(url: URL, patch: GalleryUrlStatePatch): URL {
  const nextUrl = new URL(url);

  if (patch.showAttract !== undefined) {
    if (patch.showAttract) nextUrl.searchParams.set("view", "attract");
    else nextUrl.searchParams.delete("view");
  }

  if (patch.selectedArtworkId !== undefined) {
    if (patch.selectedArtworkId) nextUrl.searchParams.set("artwork", patch.selectedArtworkId);
    else nextUrl.searchParams.delete("artwork");
  }

  return nextUrl;
}
