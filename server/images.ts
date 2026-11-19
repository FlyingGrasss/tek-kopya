import {
  IMAGE_MIMES,
  MAX_BLOB_BYTES,
  type ImageMime,
} from "../shared/constants.js";
import { ApiError, validationError } from "./errors.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

export function normalizeImageMime(raw: string): ImageMime | null {
  const value = raw.trim().toLowerCase();
  if (value === "image/jpg") return "image/jpeg";
  return (IMAGE_MIMES as readonly string[]).includes(value)
    ? (value as ImageMime)
    : null;
}

export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 8 && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    JPEG_SIGNATURE.every((byte, index) => bytes[index] === byte)
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export interface DecodedImage {
  mime: ImageMime;
  bytes: Buffer;
}

/**
 * Decodes the browser FileReader data URL, checks the declared mime against
 * the actual magic bytes and enforces the per-blob size limit.
 */
export function decodeImageDataUrl(
  dataUrl: string,
  maxBytes: number = MAX_BLOB_BYTES,
): DecodedImage {
  // A 2 MB payload becomes roughly 2.8 MB of base64. Reject obviously
  // oversized strings before allocating the decoded buffer.
  if (dataUrl.length > Math.ceil((maxBytes * 4) / 3) + 512) {
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Görsel en fazla 2 MB olabilir.",
      { field: "blob" },
    );
  }

  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(dataUrl);
  if (!match) {
    throw validationError(
      "blob",
      "Görsel data URL biçiminde olmalı (data:image/...;base64,...).",
    );
  }

  const mime = normalizeImageMime(match[1] ?? "");
  if (!mime) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Yalnızca PNG, JPEG, WebP ve GIF görselleri destekleniyor.",
      { field: "blob" },
    );
  }

  const bytes = Buffer.from(match[2] ?? "", "base64");
  if (bytes.length === 0) {
    throw validationError("blob", "Görsel boş olamaz.");
  }

  if (bytes.length > maxBytes) {
    throw new ApiError(
      413,
      "PAYLOAD_TOO_LARGE",
      "Görsel en fazla 2 MB olabilir.",
      { field: "blob" },
    );
  }

  const detected = detectImageMime(bytes);
  if (!detected) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Dosya geçerli bir PNG, JPEG, WebP veya GIF değil.",
      { field: "blob" },
    );
  }

  if (detected !== mime) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Bildirilen görsel türü dosya içeriğiyle uyuşmuyor.",
      { field: "blob" },
    );
  }

  return { mime: detected, bytes };
}
