import { Router } from "express";
import {
  MAX_MESSAGE_BODY,
  MAX_SENDER_LENGTH,
  type ImageMime,
} from "../../shared/constants.js";
import type {
  BlobMeta,
  CreateMessageResponse,
  DeleteMessageResponse,
  MessageDto,
} from "../../shared/types.js";
import { findBlob, hashBytes, relativeBlobPath, removeBlobFile, writeBlobFile } from "../blobs.js";
import type { AppContext } from "../context.js";
import { notFound, validationError, ApiError } from "../errors.js";
import {
  asRecord,
  clientIp,
  enforceRateLimit,
  pathParam,
} from "../http.js";
import { decodeImageDataUrl, normalizeImageMime } from "../images.js";

interface ChatRow {
  id: string;
  name: string;
  created_at: number;
}

interface MessageRow {
  id: number;
  chat_id: string;
  sender: string;
  body: string;
  created_at: number;
  blob_id: string | null;
  mime: string | null;
  size: number | null;
  ref_count: number | null;
  blob_created_at: number | null;
}

interface DeletedRow {
  id: number;
  blob_id: string | null;
  ref_count: number | null;
}

function readSender(value: unknown): string {
  if (typeof value !== "string") {
    throw validationError("sender", "Gönderen adı gerekli.");
  }
  const sender = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, MAX_SENDER_LENGTH);
  if (sender.length === 0) {
    throw validationError("sender", "Gönderen adı gerekli.");
  }
  return sender;
}

function readBody(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw validationError("body", "Mesaj metni geçersiz.");
  }
  const body = value.trim();
  if (body.length > MAX_MESSAGE_BODY) {
    throw validationError(
      "body",
      `Mesaj en fazla ${MAX_MESSAGE_BODY} karakter olabilir.`,
    );
  }
  return body;
}

function readMessageId(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw validationError("id", "Mesaj kimliği geçersiz.");
  }
  return id;
}

function mapMessage(row: MessageRow): MessageDto {
  const blob: BlobMeta | null =
    row.blob_id === null
      ? null
      : {
          id: row.blob_id,
          mime: (row.mime ?? "image/png") as ImageMime,
          size: row.size ?? 0,
          refCount: row.ref_count ?? 0,
          createdAt: row.blob_created_at ?? row.created_at,
        };

  return {
    id: row.id,
    chatId: row.chat_id,
    sender: row.sender,
    body: row.body,
    createdAt: row.created_at,
    blob,
  };
}

export function createMessagesRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/chats/:id/messages", (req, res) => {
    const chatId = pathParam(req, "id");
    const chat = ctx.db
      .prepare("SELECT id, name, created_at FROM chats WHERE id = ?")
      .get(chatId) as ChatRow | undefined;
    if (!chat) throw notFound("Sohbet bulunamadı.");

    const rows = ctx.db
      .prepare(
        `SELECT
           m.id, m.chat_id, m.sender, m.body, m.created_at,
           m.blob_id, b.mime, b.size, b.ref_count, b.created_at AS blob_created_at
         FROM messages m
         LEFT JOIN blobs b ON b.id = m.blob_id
         WHERE m.chat_id = ?
         ORDER BY m.id ASC`,
      )
      .all(chatId) as MessageRow[];

    res.json({
      chat: { id: chat.id, name: chat.name, createdAt: chat.created_at },
      messages: rows.map(mapMessage),
    });
  });

  router.post("/chats/:id/messages", (req, res) => {
    const chatId = pathParam(req, "id");
    const chat = ctx.db
      .prepare("SELECT id FROM chats WHERE id = ?")
      .get(chatId) as { id: string } | undefined;
    if (!chat) throw notFound("Sohbet bulunamadı.");

    enforceRateLimit(ctx.messageLimiter, `message:${clientIp(req)}`, res);

    const payload = asRecord(req.body);
    const sender = readSender(payload.sender);
    const body = readBody(payload.body);

    let image: { mime: ImageMime; bytes: Buffer } | null = null;
    if (payload.blob !== undefined && payload.blob !== null) {
      const blobInput = asRecord(payload.blob);
      const dataUrl = blobInput.dataUrl;
      const declaredMime = blobInput.mime;
      if (typeof dataUrl !== "string" || typeof declaredMime !== "string") {
        throw validationError("blob", "Görsel verisi eksik.");
      }
      const declared = normalizeImageMime(declaredMime);
      if (!declared) {
        throw new ApiError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Yalnızca PNG, JPEG, WebP ve GIF görselleri destekleniyor.",
          { field: "blob" },
        );
      }
      image = decodeImageDataUrl(dataUrl, ctx.config.maxBlobBytes);
      if (image.mime !== declared) {
        throw new ApiError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Bildirilen görsel türü dosya içeriğiyle uyuşmuyor.",
          { field: "blob" },
        );
      }
    }

    if (body.length === 0 && image === null) {
      throw validationError("body", "Mesaj metni veya bir görsel gerekli.");
    }

    const createdAt = Date.now();
    let blobId: string | null = null;
    let deduped = false;
    let messageId = 0;

    if (image) {
      const decoded = image;
      const hash = hashBytes(decoded.bytes);
      blobId = hash;
      const existing = findBlob(ctx.db, hash);
      deduped = existing !== undefined;

      if (!existing) {
        writeBlobFile(ctx.config.blobsDir, hash, decoded.bytes);
      }

      try {
        messageId = ctx.db.transaction(() => {
          if (existing) {
            ctx.db
              .prepare("UPDATE blobs SET ref_count = ref_count + 1 WHERE id = ?")
              .run(hash);
          } else {
            ctx.db
              .prepare(
                `INSERT INTO blobs (id, mime, size, ref_count, created_at, path)
                 VALUES (?, ?, ?, 1, ?, ?)`,
              )
              .run(
                hash,
                decoded.mime,
                decoded.bytes.length,
                createdAt,
                relativeBlobPath(hash),
              );
          }

          const result = ctx.db
            .prepare(
              `INSERT INTO messages (chat_id, sender, body, blob_id, created_at)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .run(chatId, sender, body, hash, createdAt);

          return Number(result.lastInsertRowid);
        })();
      } catch (error) {
        if (!existing) removeBlobFile(ctx.config.blobsDir, hash);
        throw error;
      }
    } else {
      const result = ctx.db
        .prepare(
          `INSERT INTO messages (chat_id, sender, body, blob_id, created_at)
           VALUES (?, ?, ?, NULL, ?)`,
        )
        .run(chatId, sender, body, createdAt);
      messageId = Number(result.lastInsertRowid);
    }

    const response: CreateMessageResponse = { messageId, blobId, deduped };
    res.status(201).json(response);
  });

  router.delete("/messages/:id", (req, res) => {
    const messageId = readMessageId(pathParam(req, "id"));
    const row = ctx.db
      .prepare(
        `SELECT m.id, m.blob_id, b.ref_count
         FROM messages m
         LEFT JOIN blobs b ON b.id = m.blob_id
         WHERE m.id = ?`,
      )
      .get(messageId) as DeletedRow | undefined;
    if (!row) throw notFound("Mesaj bulunamadı.");

    let blobDeleted = false;
    let refCount: number | null = null;

    ctx.db.transaction(() => {
      ctx.db.prepare("DELETE FROM messages WHERE id = ?").run(messageId);

      if (row.blob_id === null) return;

      const current = ctx.db
        .prepare("SELECT ref_count FROM blobs WHERE id = ?")
        .get(row.blob_id) as { ref_count: number } | undefined;
      if (!current) return;

      refCount = Math.max(0, current.ref_count - 1);
      if (refCount === 0) {
        ctx.db.prepare("DELETE FROM blobs WHERE id = ?").run(row.blob_id);
        blobDeleted = true;
      } else {
        ctx.db
          .prepare("UPDATE blobs SET ref_count = ? WHERE id = ?")
          .run(refCount, row.blob_id);
      }
    })();

    if (blobDeleted && row.blob_id) {
      removeBlobFile(ctx.config.blobsDir, row.blob_id);
    }

    const response: DeleteMessageResponse = {
      messageId,
      blobId: row.blob_id,
      blobDeleted,
      refCount,
    };
    res.json(response);
  });

  return router;
}
