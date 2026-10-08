import type { Namespace } from "socket.io";
import type { Realtime, StatusEvents, StatusSubscriptions } from "./types.js";

const roomFor = (jobId: string) => `job:${jobId}`;

export function createJobEmitter(namespace: Namespace<StatusSubscriptions, StatusEvents>): Pick<Realtime, "emitJob"> {
  namespace.on("connection", (socket) => {
    socket.on("subscribe", (jobId: unknown) => {
      if (typeof jobId !== "string" || jobId.trim().length === 0) return;
      // Socket.IO manages room membership and disconnect cleanup. No job cache:
      // clients fetch missed updates through the REST status endpoint.
      void socket.join(roomFor(jobId));
    });
  });

  return {
    emitJob(jobId, job) {
      // A routing typo must never send another job's payload to this room.
      if (job.jobId !== jobId) return;
      namespace.to(roomFor(jobId)).emit("job", job);
    }
  };
}
