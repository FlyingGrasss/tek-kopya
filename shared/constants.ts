export const WEB_PORT = 3000;
export const API_PORT = 4700;

export const MAX_BLOB_BYTES = 2 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_MESSAGE_BODY = 2_000;
export const MAX_SENDER_LENGTH = 32;
export const MAX_CHAT_NAME = 48;

export const MESSAGE_RATE_LIMIT = 10;
export const MESSAGE_RATE_WINDOW_MS = 60_000;

export const DEVICE_CACHE_MAX_BYTES = 16 * 1024 * 1024;
export const DEVICE_CACHE_MAX_ENTRIES = 40;

export const DEFAULT_ALLOWED_ORIGINS = [
  `http://localhost:${WEB_PORT}`,
  `http://127.0.0.1:${WEB_PORT}`,
] as const;

export const IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type ImageMime = (typeof IMAGE_MIMES)[number];
