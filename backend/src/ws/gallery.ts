import type { Namespace } from "socket.io";
import type { GalleryEvents, Realtime } from "./types.js";

export function createGalleryEmitter(namespace: Namespace<{}, GalleryEvents>): Pick<Realtime, "emitNew" | "emitHide" | "emitLikeCount"> {
  return {
    emitNew(item) {
      // Gallery clients are public; approval is required before broadcasting.
      if (item.status === "approved") namespace.emit("new", item);
    },
    emitHide(id) {
      namespace.emit("hide", { id });
    },
    emitLikeCount(artworkId, likes) {
      namespace.emit("like-count", { artworkId, likes });
    }
  };
}
