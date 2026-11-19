import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { createApp } from "./app.js";
import type { AppContext } from "./context.js";
import { createContext } from "./context.js";

export interface StartServerOptions {
  context?: AppContext;
  port?: number;
  host?: string;
}

export interface RunningServer {
  app: Express;
  httpServer: HttpServer;
  context: AppContext;
  port: number;
  close(): Promise<void>;
}

export async function startServer(
  options: StartServerOptions = {},
): Promise<RunningServer> {
  const context = options.context ?? createContext();
  const app = createApp(context);
  const httpServer = createServer(app);

  const port = options.port ?? context.config.port;
  const host = options.host ?? context.config.host;

  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = (error: Error) => {
      httpServer.off("listening", onListening);
      rejectListen(error);
    };
    const onListening = () => {
      httpServer.off("error", onError);
      resolveListen();
    };

    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen(port, host);
  });

  const address = httpServer.address() as AddressInfo | null;
  const actualPort = address ? address.port : port;

  let closing: Promise<void> | null = null;
  const close = (): Promise<void> => {
    if (closing) return closing;

    closing = (async () => {
      await new Promise<void>((resolveClose) => {
        httpServer.close(() => resolveClose());
        httpServer.closeAllConnections();
      });
      context.close();
    })();

    return closing;
  };

  return { app, httpServer, context, port: actualPort, close };
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // .env is optional.
  }

  const running = await startServer();
  console.log(
    `[api] listening on http://${running.context.config.host}:${running.port}`,
  );
  console.log(`[api] database: ${running.context.config.dbPath}`);
  console.log(`[api] blobs: ${running.context.config.blobsDir}`);

  if (
    running.context.config.isProduction &&
    running.context.config.allowedOrigins.every((origin) => origin.includes("localhost"))
  ) {
    console.warn("[api] APP_ORIGINS üretimde localhost; gerçek web kaynağını ayarlayın.");
  }

  let stopping = false;
  const stop = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    console.log(`[api] ${signal} alındı, kapatılıyor...`);

    try {
      await running.close();
    } catch (error) {
      console.error("[api] kapatma hatası", error);
      process.exitCode = 1;
    }

    process.exit(process.exitCode ?? 0);
  };

  process.once("SIGINT", () => {
    void stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    void stop("SIGTERM");
  });
}

const entry = (process.argv[1] ?? "").replace(/\\/g, "/");
if (/\/server\/index\.(ts|js)$/.test(entry)) {
  void main().catch((error) => {
    console.error("[api] başlatılamadı", error);
    process.exit(1);
  });
}
