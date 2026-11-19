import { Router } from "express";
import type { AppContext } from "../context.js";

export function createMetaRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "tek-kopya-api",
      blobs: (ctx.db.prepare("SELECT COUNT(*) AS count FROM blobs").get() as {
        count: number;
      }).count,
    });
  });

  return router;
}
