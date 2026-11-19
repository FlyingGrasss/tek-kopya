import { randomUUID } from "node:crypto";
import { Router } from "express";
import { MAX_CHAT_NAME } from "../../shared/constants.js";
import type { ChatSummary } from "../../shared/types.js";
import type { AppContext } from "../context.js";
import { ApiError, notFound, validationError } from "../errors.js";
import { asRecord, pathParam } from "../http.js";

interface ChatRow {
  id: string;
  name: string;
  created_at: number;
  message_count: number;
  last_id: number | null;
  last_sender: string | null;
  last_body: string | null;
  last_created_at: number | null;
  last_blob_id: string | null;
}

const CHAT_SELECT = `
  SELECT
    c.id,
    c.name,
    c.created_at,
    (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS message_count,
    lm.id AS last_id,
    lm.sender AS last_sender,
    lm.body AS last_body,
    lm.created_at AS last_created_at,
    lm.blob_id AS last_blob_id
  FROM chats c
  LEFT JOIN messages lm
    ON lm.id = (SELECT MAX(m2.id) FROM messages m2 WHERE m2.chat_id = c.id)
`;

function toChatSummary(row: ChatRow): ChatSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    messageCount: row.message_count,
    lastMessage:
      row.last_id === null
        ? null
        : {
            id: row.last_id,
            sender: row.last_sender ?? "",
            body: row.last_body ?? "",
            createdAt: row.last_created_at ?? row.created_at,
            hasBlob: row.last_blob_id !== null,
          },
  };
}

function listChats(ctx: AppContext): ChatSummary[] {
  const rows = ctx.db
    .prepare(`${CHAT_SELECT} ORDER BY COALESCE(lm.created_at, c.created_at) DESC`)
    .all() as ChatRow[];
  return rows.map(toChatSummary);
}

function findChatRow(ctx: AppContext, id: string): ChatRow | undefined {
  return ctx.db
    .prepare(`${CHAT_SELECT} WHERE c.id = ?`)
    .get(id) as ChatRow | undefined;
}

export function createChatsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ chats: listChats(ctx) });
  });

  router.post("/", (req, res) => {
    const body = asRecord(req.body);
    const rawName = body.name;
    if (typeof rawName !== "string") {
      throw validationError("name", "Sohbet adı gerekli.");
    }

    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length < 1 || name.length > MAX_CHAT_NAME) {
      throw validationError(
        "name",
        `Sohbet adı 1-${MAX_CHAT_NAME} karakter arasında olmalı.`,
      );
    }

    const duplicate = ctx.db
      .prepare("SELECT id FROM chats WHERE name = ? COLLATE NOCASE")
      .get(name) as { id: string } | undefined;
    if (duplicate) {
      throw new ApiError(409, "CHAT_EXISTS", "Bu adda bir sohbet zaten var.", {
        field: "name",
      });
    }

    const id = `chat_${randomUUID()}`;
    const createdAt = Date.now();
    ctx.db
      .prepare("INSERT INTO chats (id, name, created_at) VALUES (?, ?, ?)")
      .run(id, name, createdAt);

    const row = findChatRow(ctx, id);
    if (!row) throw new ApiError(500, "INTERNAL_ERROR", "Sohbet oluşturulamadı.");

    res.status(201).json({ chat: toChatSummary(row) });
  });

  router.get("/:id", (req, res) => {
    const id = pathParam(req, "id");
    const row = findChatRow(ctx, id);
    if (!row) throw notFound("Sohbet bulunamadı.");
    res.json({ chat: toChatSummary(row) });
  });

  return router;
}
