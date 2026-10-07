import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { createGalleryEmitter } from "./gallery.js";
import { createJobEmitter } from "./jobStatus.js";
import type { Realtime, RealtimeOptions } from "./types.js";

export type { Realtime, RealtimeOptions } from "./types.js";

/** Attach the frozen gallery/status namespaces to the application's HTTP server. */
export function createRealtime(httpServer: HttpServer, { allowedOrigin }: RealtimeOptions): Realtime {
  const io = new Server(httpServer, { cors: { origin: allowedOrigin } });
  const gallery = createGalleryEmitter(io.of("/gallery"));
  const status = createJobEmitter(io.of("/status"));
  let closing: Promise<void> | undefined;

  return {
    ...gallery,
    ...status,
    close() {
      // Repeated shutdown calls share completion, including client disconnects.
      closing ??= new Promise<void>((resolve, reject) => {
        io.close((error?: Error) => error ? reject(error) : resolve());
      });
      return closing;
    }
  };
}
