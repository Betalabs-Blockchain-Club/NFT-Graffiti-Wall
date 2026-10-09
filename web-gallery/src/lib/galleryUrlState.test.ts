import { describe, expect, it } from "vitest";
import { readGalleryUrlState, writeGalleryUrlState } from "./galleryUrlState";

describe("gallery URL state", () => {
  it("restores the wall view and selected artwork from the URL", () => {
    expect(readGalleryUrlState(new URL("https://gallery.test/wall?view=attract&artwork=art-42"))).toEqual({
      showAttract: true,
      selectedArtworkId: "art-42",
    });
  });

  it("updates gallery state without dropping route or other query parameters", () => {
    const url = writeGalleryUrlState(
      new URL("https://gallery.test/exhibit?search=neon&page=3&sort=likes"),
      { showAttract: true, selectedArtworkId: "art 42" },
    );

    expect(url.pathname).toBe("/exhibit");
    expect(url.searchParams.get("search")).toBe("neon");
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("sort")).toBe("likes");
    expect(readGalleryUrlState(url)).toEqual({ showAttract: true, selectedArtworkId: "art 42" });
  });

  it("removes cleared state while retaining unrelated parameters", () => {
    const url = writeGalleryUrlState(
      new URL("https://gallery.test/?view=attract&artwork=art-42&filter=approved"),
      { showAttract: false, selectedArtworkId: null },
    );

    expect(url.searchParams.has("view")).toBe(false);
    expect(url.searchParams.has("artwork")).toBe(false);
    expect(url.searchParams.get("filter")).toBe("approved");
  });
});
