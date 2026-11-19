import { Router } from "express";
import { findBlob, isValidBlobId, readBlobFile } from "../blobs.js";
import type { AppContext } from "../context.js";
import { notFound, validationError } from "../errors.js";
import { pathParam, queryParam } from "../http.js";

const USER_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "png";
  }
}

export function createBlobsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/:id", (req, res) => {
    const id = pathParam(req, "id").toLowerCase();
    if (!isValidBlobId(id)) {
      throw validationError("id", "Görsel kimliği geçersiz.");
    }

    const row = findBlob(ctx.db, id);
    if (!row) throw notFound("Görsel bulunamadı.");

    const etag = `"${id}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("Content-Type", row.mime);
    res.setHeader("Content-Length", String(row.size));
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${id}.${extensionFor(row.mime)}"`,
    );

    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    const bytes = readBlobFile(ctx.config.blobsDir, id);
    res.status(200).send(bytes);

    // Thumbnail loads use ?preview=1 and are intentionally not counted as a
    // recipient opening the media. A real full-size view is a fetch.
    if (req.method !== "HEAD" && queryParam(req, "preview") !== "1") {
      const rawUser = queryParam(req, "user") ?? "web";
      const user = USER_PATTERN.test(rawUser) ? rawUser : "web";
      ctx.db
        .prepare("INSERT INTO fetches (blob_id, user, created_at) VALUES (?, ?, ?)")
        .run(id, user, Date.now());
    }
  });

  router.head("/:id", (req, res) => {
    const id = pathParam(req, "id").toLowerCase();
    if (!isValidBlobId(id)) {
      throw validationError("id", "Görsel kimliği geçersiz.");
    }

    const row = findBlob(ctx.db, id);
    if (!row) throw notFound("Görsel bulunamadı.");

    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.setHeader("Content-Type", row.mime);
    res.setHeader("Content-Length", String(row.size));
    res.setHeader("ETag", `"${id}"`);
    res.status(200).end();
  });

  return router;
}
