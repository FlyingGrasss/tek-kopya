import { Router } from "express";
import type { ImageMime } from "../../shared/constants.js";
import type { MetricsResponse, TopBlob } from "../../shared/types.js";
import type { AppContext } from "../context.js";

interface AggregateRow {
  total_blobs: number;
  total_references: number;
  total_bytes: number;
  bytes_saved: number;
}

interface TopRow {
  id: string;
  mime: string;
  size: number;
  ref_count: number;
  created_at: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createMetricsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const now = Date.now();
    const aggregate = ctx.db
      .prepare(
        `SELECT
           COUNT(*) AS total_blobs,
           COALESCE(SUM(ref_count), 0) AS total_references,
           COALESCE(SUM(size), 0) AS total_bytes,
           COALESCE(SUM(size * MAX(ref_count - 1, 0)), 0) AS bytes_saved
         FROM blobs`,
      )
      .get() as AggregateRow;

    const logicalBytes = aggregate.total_bytes + aggregate.bytes_saved;
    const dedupeRate = logicalBytes > 0 ? aggregate.bytes_saved / logicalBytes : 0;

    const fetches = ctx.db
      .prepare("SELECT COUNT(*) AS count FROM fetches WHERE created_at >= ?")
      .get(now - DAY_MS) as { count: number };

    const topRows = ctx.db
      .prepare(
        `SELECT id, mime, size, ref_count, created_at
         FROM blobs
         ORDER BY ref_count DESC, size DESC
         LIMIT 6`,
      )
      .all() as TopRow[];

    const topBlobs: TopBlob[] = topRows.map((row) => ({
      id: row.id,
      mime: row.mime as ImageMime,
      size: row.size,
      refCount: row.ref_count,
      createdAt: row.created_at,
      wouldBeBytes: row.size * row.ref_count,
    }));

    const response: MetricsResponse = {
      totalBlobs: aggregate.total_blobs,
      totalReferences: aggregate.total_references,
      totalBytesStored: aggregate.total_bytes,
      bytesSaved: aggregate.bytes_saved,
      dedupeRate,
      fetches24h: fetches.count,
      topBlobs,
      generatedAt: now,
    };

    res.json(response);
  });

  return router;
}
