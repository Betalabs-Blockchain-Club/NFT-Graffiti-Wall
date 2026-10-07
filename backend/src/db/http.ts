import type { Request, RequestHandler, Response } from "express";
import { StorageError } from "./errors.js";

/** Catch synchronous DB failures and rejected async hooks in Express 4. */
export function route(handler: (req: Request, res: Response) => unknown | Promise<unknown>): RequestHandler {
  return (req, res) => {
    void Promise.resolve().then(() => handler(req, res)).catch((error: unknown) => {
      if (res.headersSent) return;
      if (error instanceof StorageError) {
        res.status(error.status).json({ code: error.code, message: error.message });
      } else {
        res.status(500).json({ code: "internal-error", message: "Unable to complete request" });
      }
    });
  };
}
