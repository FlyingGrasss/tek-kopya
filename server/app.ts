import express, { type NextFunction, type Request, type Response } from "express";
import { MAX_REQUEST_BYTES } from "../shared/constants.js";
import type { AppContext } from "./context.js";
import { ApiError, sendApiError } from "./errors.js";
import {
  createOriginGuard,
  requireJsonForMutations,
} from "./http.js";
import { createBlobsRouter } from "./routes/blobs.js";
import { createChatsRouter } from "./routes/chats.js";
import { createMessagesRouter } from "./routes/messages.js";
import { createMetaRouter } from "./routes/meta.js";
import { createMetricsRouter } from "./routes/metrics.js";

export function createApp(ctx: AppContext): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("case sensitive routing", true);

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use("/api", createOriginGuard(ctx.config));
  app.use("/api", requireJsonForMutations);
  app.use(
    "/api",
    express.json({
      limit: MAX_REQUEST_BYTES,
      type: "application/json",
      strict: true,
    }),
  );

  app.use("/api/chats", createChatsRouter(ctx));
  app.use("/api", createMessagesRouter(ctx));
  app.use("/api/blobs", createBlobsRouter(ctx));
  app.use("/api/metrics", createMetricsRouter(ctx));
  app.use("/api", createMetaRouter(ctx));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Kaynak bulunamadı." },
    });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Kaynak bulunamadı." },
    });
  });

  app.use(apiErrorHandler);

  return app;
}

function apiErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    sendApiError(res, error);
    return;
  }

  const type = readErrorType(error);

  if (type === "entity.too.large") {
    sendApiError(
      res,
      new ApiError(
        413,
        "PAYLOAD_TOO_LARGE",
        "İstek gövdesi çok büyük. Görsel en fazla 2 MB olabilir.",
      ),
    );
    return;
  }

  if (type === "entity.parse.failed") {
    sendApiError(
      res,
      new ApiError(400, "VALIDATION_ERROR", "İstek gövdesi geçerli JSON değil."),
    );
    return;
  }

  if (type === "charset.unsupported" || type === "encoding.unsupported") {
    sendApiError(
      res,
      new ApiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Desteklenmeyen karakter kodlaması.",
      ),
    );
    return;
  }

  console.error(`[api] ${req.method} ${req.path} işlenemedi:`, error);
  sendApiError(
    res,
    new ApiError(500, "INTERNAL_ERROR", "Beklenmeyen bir sunucu hatası oluştu."),
  );
}

function readErrorType(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("type" in error)) {
    return undefined;
  }
  const type = (error as { type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}
