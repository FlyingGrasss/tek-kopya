import { resolve } from "node:path";
import {
  API_PORT,
  DEFAULT_ALLOWED_ORIGINS,
  MAX_BLOB_BYTES,
} from "../shared/constants.js";

export interface AppConfig {
  port: number;
  host: string;
  dbPath: string;
  blobsDir: string;
  maxBlobBytes: number;
  isProduction: boolean;
  allowedOrigins: string[];
}

export function resolveConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: parsePort(env.API_PORT),
    host: env.API_HOST?.trim() || "127.0.0.1",
    dbPath: resolve(process.cwd(), env.DB_PATH?.trim() || "data/tek-kopya.db"),
    blobsDir: resolve(process.cwd(), env.BLOBS_DIR?.trim() || "data/blobs"),
    maxBlobBytes: MAX_BLOB_BYTES,
    isProduction: env.NODE_ENV === "production",
    allowedOrigins: parseOrigins(env.APP_ORIGINS),
  };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return API_PORT;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`API_PORT 1 ile 65535 arasında bir tam sayı olmalı (verilen: ${raw}).`);
  }
  return port;
}

function parseOrigins(raw: string | undefined): string[] {
  const values = (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) return [...DEFAULT_ALLOWED_ORIGINS];

  return [
    ...new Set(
      values.map((value) => {
        let parsed: URL;
        try {
          parsed = new URL(value);
        } catch {
          throw new Error(`APP_ORIGINS geçerli bir kaynak içermiyor: ${value}`);
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error(`APP_ORIGINS yalnızca http/https kaynakları kabul eder: ${value}`);
        }
        return parsed.origin;
      }),
    ),
  ];
}
