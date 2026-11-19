import { resolve } from "node:path";
import {
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW_MS,
} from "../shared/constants.js";
import type { AppConfig } from "./config.js";
import { resolveConfig } from "./config.js";
import type { AppDatabase } from "./db.js";
import { openDatabase } from "./db.js";
import { TokenBucketRateLimiter } from "./rate-limit.js";

export interface AppContext {
  config: AppConfig;
  db: AppDatabase;
  messageLimiter: TokenBucketRateLimiter;
  close(): void;
}

export interface CreateContextOptions {
  env?: NodeJS.ProcessEnv;
  config?: AppConfig;
  dbPath?: string;
  blobsDir?: string;
  schemaPath?: string;
  isProduction?: boolean;
  allowedOrigins?: string[];
}

export function createContext(options: CreateContextOptions = {}): AppContext {
  const base = options.config ?? resolveConfig(options.env);
  const config: AppConfig = {
    ...base,
    ...(options.dbPath ? { dbPath: resolve(options.dbPath) } : {}),
    ...(options.blobsDir ? { blobsDir: resolve(options.blobsDir) } : {}),
    ...(options.isProduction !== undefined
      ? { isProduction: options.isProduction }
      : {}),
    ...(options.allowedOrigins ? { allowedOrigins: [...options.allowedOrigins] } : {}),
  };

  const db = openDatabase(config.dbPath, options.schemaPath);
  const messageLimiter = new TokenBucketRateLimiter(
    MESSAGE_RATE_LIMIT,
    MESSAGE_RATE_WINDOW_MS,
  );

  let closed = false;

  return {
    config,
    db,
    messageLimiter,
    close() {
      if (closed) return;
      closed = true;
      db.close();
    },
  };
}
