import type { Response } from "express";
import type { ApiErrorBody, ApiErrorCode } from "../shared/types.js";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly field?: string;
  readonly retryAfterMs?: number;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: { field?: string; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = options.field;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export function validationError(field: string, message: string): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message, { field });
}

export function notFound(message = "Kaynak bulunamadı."): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

export function toErrorResponse(error: ApiError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
      ...(error.retryAfterMs !== undefined ? { retryAfterMs: error.retryAfterMs } : {}),
    },
  };
}

export function sendApiError(res: Response, error: ApiError): void {
  if (error.retryAfterMs !== undefined && !res.headersSent) {
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil(error.retryAfterMs / 1000))),
    );
  }
  res.status(error.status).json(toErrorResponse(error));
}
