import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AppConfig } from "./config.js";
import { ApiError } from "./errors.js";
import type { TokenBucketRateLimiter } from "./rate-limit.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function queryParam(req: Request, name: string): string | null {
  const value = req.query[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return null;
}

export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function requireJsonForMutations(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next();
    return;
  }

  if (!req.is("application/json")) {
    const contentLength = req.headers["content-length"];
    const hasBody =
      (contentLength !== undefined && Number(contentLength) > 0) ||
      req.headers["transfer-encoding"] !== undefined;

    if (hasBody) {
      next(
        new ApiError(
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "İstek gövdesi application/json olmalı.",
        ),
      );
      return;
    }
  }

  next();
}

/**
 * The demo has no accounts, so Origin is the only request-forgery boundary.
 * Browser requests always carry Origin for mutations; header-less CLI calls
 * are allowed so the smoke test and curl stay usable.
 */
export function createOriginGuard(config: AppConfig): RequestHandler {
  return (req, _res, next) => {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.get("origin");
    if (origin && !config.allowedOrigins.includes(origin)) {
      next(
        new ApiError(
          403,
          "ORIGIN_REJECTED",
          "İstek kaynağına izin verilmiyor.",
        ),
      );
      return;
    }

    next();
  };
}

export function enforceRateLimit(
  limiter: TokenBucketRateLimiter,
  key: string,
  res: Response,
): void {
  const decision = limiter.take(key);
  if (decision.allowed) return;

  res.setHeader(
    "Retry-After",
    String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))),
  );
  throw new ApiError(
    429,
    "RATE_LIMITED",
    "Çok fazla mesaj gönderdin. Bir dakika içinde tekrar dene.",
    { retryAfterMs: decision.retryAfterMs },
  );
}
