import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_BLOB_BYTES,
  MESSAGE_RATE_LIMIT,
} from "../shared/constants.js";
import type {
  ChatsResponse,
  CreateMessageResponse,
  DeleteMessageResponse,
  MessagesResponse,
  MetricsResponse,
} from "../shared/types.js";
import { createApp } from "./app.js";
import type { AppContext } from "./context.js";
import { createContext } from "./context.js";
import { createPng } from "./png.js";

const TEST_ORIGIN = "http://localhost:3000";

interface ApiResult {
  status: number;
  data: unknown;
  headers: Headers;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  origin?: string | null;
}

function ensure(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`  ✓ ${message}`);
}

function errorCode(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const error = (data as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

async function startTestServer(
  ctx: AppContext,
): Promise<{ server: Server; baseUrl: string }> {
  const app = createApp(ctx);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeTestServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose) => {
    server.close(() => resolveClose());
    server.closeAllConnections();
  });
}

function makeApi(baseUrl: string) {
  return async function api(path: string, options: ApiOptions = {}): Promise<ApiResult> {
    const method = options.method ?? "GET";
    const headers: Record<string, string> = {};
    const mutating = method !== "GET" && method !== "HEAD";

    if (mutating) {
      headers.origin = TEST_ORIGIN;
      headers["content-type"] = "application/json";
    }
    if (options.origin !== undefined) {
      if (options.origin === null) delete headers.origin;
      else headers.origin = options.origin;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return { status: response.status, data, headers: response.headers };
  };
}

function makeTestPng(): Buffer {
  return createPng(48, 36, (x, y) => {
    const stripe = Math.floor((x + y) / 8) % 2 === 0 ? 18 : 0;
    return [42 + stripe, 170 - y, 120 + x, 255];
  });
}

async function main(): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "tek-kopya-smoke-"));
  const servers: Server[] = [];
  let ctx: AppContext | undefined;
  let rateCtx: AppContext | undefined;

  try {
    const blobsDir = join(tempDir, "blobs");
    ctx = createContext({
      dbPath: join(tempDir, "tek-kopya.db"),
      blobsDir,
      allowedOrigins: [TEST_ORIGIN],
      isProduction: false,
    });
    const { server, baseUrl } = await startTestServer(ctx);
    servers.push(server);
    const api = makeApi(baseUrl);

    console.log("Tek Kopya smoke testi\n");

    const health = await api("/api/health");
    ensure(health.status === 200, "GET /api/health 200");

    const emptyChats = await api("/api/chats");
    ensure(
      (emptyChats.data as ChatsResponse).chats.length === 0,
      "boş veritabanında sohbet listesi boş",
    );

    const chatA = await api("/api/chats", {
      method: "POST",
      body: { name: "Aile" },
    });
    ensure(chatA.status === 201, "sohbet oluşturma 201");
    const chatAId = (chatA.data as { chat: { id: string } }).chat.id;

    const chatB = await api("/api/chats", {
      method: "POST",
      body: { name: "Kamp 2026" },
    });
    ensure(chatB.status === 201, "ikinci sohbet 201");
    const chatBId = (chatB.data as { chat: { id: string } }).chat.id;

    const duplicateChat = await api("/api/chats", {
      method: "POST",
      body: { name: "aile" },
    });
    ensure(duplicateChat.status === 409, "yinelenen sohbet adı 409");
    ensure(errorCode(duplicateChat.data) === "CHAT_EXISTS", "409 kodu CHAT_EXISTS");

    const blankChat = await api("/api/chats", {
      method: "POST",
      body: { name: "   " },
    });
    ensure(blankChat.status === 400, "boş sohbet adı 400");

    const badOrigin = await api("/api/chats", {
      method: "POST",
      body: { name: "Kötü Kaynak" },
      origin: "http://evil.example",
    });
    ensure(badOrigin.status === 403, "izin verilmeyen Origin 403");
    ensure(errorCode(badOrigin.data) === "ORIGIN_REJECTED", "403 kodu ORIGIN_REJECTED");

    const png = makeTestPng();
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

    const first = await api(`/api/chats/${chatAId}/messages`, {
      method: "POST",
      body: {
        sender: "Elif",
        body: "Aynı görseli iki sohbette paylaşıyorum.",
        blob: { dataUrl, mime: "image/png" },
      },
    });
    ensure(first.status === 201, "görselli mesaj oluşturma 201");
    const firstMessage = first.data as CreateMessageResponse;
    ensure(firstMessage.deduped === false, "ilk görsel yeni blob (deduped=false)");
    ensure(typeof firstMessage.blobId === "string", "yanıt blobId içeriyor");

    const second = await api(`/api/chats/${chatBId}/messages`, {
      method: "POST",
      body: {
        sender: "Mert",
        body: "Aynı baytlar, farklı sohbet.",
        blob: { dataUrl, mime: "image/png" },
      },
    });
    ensure(second.status === 201, "ikinci görselli mesaj 201");
    const secondMessage = second.data as CreateMessageResponse;
    ensure(secondMessage.deduped === true, "aynı içerik ikinci kez deduped=true");
    ensure(
      secondMessage.blobId === firstMessage.blobId,
      "iki mesaj aynı blob kimliğini paylaşıyor",
    );

    const blobId = firstMessage.blobId ?? "";
    const row = ctx.db
      .prepare("SELECT size, ref_count FROM blobs WHERE id = ?")
      .get(blobId) as { size: number; ref_count: number } | undefined;
    ensure(row !== undefined, "blob veritabanında");
    ensure(row?.ref_count === 2, "ref_count 2");

    const blobCount = ctx.db
      .prepare("SELECT COUNT(*) AS count FROM blobs")
      .get() as { count: number };
    ensure(blobCount.count === 1, "toplam blob sayısı 1 (değişmedi)");

    const list = await api("/api/chats");
    const listedChats = (list.data as ChatsResponse).chats;
    ensure(listedChats.length === 2, "sohbet listesi 2 kayıt");
    ensure(
      listedChats.every((chat) => chat.lastMessage?.hasBlob === true),
      "sohbet listesi son mesajda görsel bilgisini taşıyor",
    );

    const messages = await api(`/api/chats/${chatAId}/messages`);
    ensure(messages.status === 200, "mesaj listesi 200");
    const messagePage = messages.data as MessagesResponse;
    ensure(messagePage.messages.length === 1, "sohbette bir mesaj");
    ensure(
      messagePage.messages[0]?.blob?.refCount === 2 &&
        messagePage.messages[0]?.blob?.size === png.length,
      "mesaj blob meta verisi bayt içermeden dönüyor",
    );
    ensure(
      !("bytes" in (messagePage.messages[0]?.blob ?? {})),
      "mesaj yanıtında görsel baytları yok",
    );

    const imageResponse = await fetch(`${baseUrl}/api/blobs/${blobId}`);
    const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
    ensure(imageResponse.status === 200, "GET /api/blobs/:id 200");
    ensure(imageBytes.equals(png), "blob baytları yüklenen görselle aynı");
    ensure(
      imageResponse.headers.get("content-type") === "image/png",
      "blob Content-Type image/png",
    );
    ensure(
      imageResponse.headers.get("cache-control")?.startsWith("private") === true,
      "blob Cache-Control private",
    );

    const afterFetch = (await api("/api/metrics")).data as MetricsResponse;
    ensure(afterFetch.fetches24h === 1, "tam boy görsel GET fetch sayıldı");
    ensure(afterFetch.totalBlobs === 1, "metrics totalBlobs 1");
    ensure(afterFetch.totalReferences === 2, "metrics totalReferences 2");
    ensure(
      afterFetch.bytesSaved === row?.size && afterFetch.bytesSaved > 0,
      "metrics bytesSaved > 0 ve blob boyutuna eşit",
    );
    ensure(
      Math.abs(afterFetch.dedupeRate - 0.5) < 0.0001,
      "metrics dedupeRate 0.5",
    );
    ensure(afterFetch.topBlobs[0]?.refCount === 2, "top blob refCount 2");

    const previewResponse = await fetch(
      `${baseUrl}/api/blobs/${blobId}?preview=1&user=Elif`,
    );
    ensure(previewResponse.status === 200, "önizleme GET 200");
    const afterPreview = (await api("/api/metrics")).data as MetricsResponse;
    ensure(afterPreview.fetches24h === 1, "önizleme fetch sayacını artırmıyor");

    const headResponse = await fetch(`${baseUrl}/api/blobs/${blobId}`, {
      method: "HEAD",
    });
    ensure(headResponse.status === 200, "HEAD /api/blobs/:id 200");
    ensure(
      headResponse.headers.get("content-length") === String(png.length),
      "HEAD Content-Length doğru",
    );
    const afterHead = (await api("/api/metrics")).data as MetricsResponse;
    ensure(afterHead.fetches24h === 1, "HEAD fetch sayacını artırmıyor");

    const invalidMime = await api(`/api/chats/${chatAId}/messages`, {
      method: "POST",
      body: {
        sender: "Elif",
        body: "Tür uyuşmazlığı",
        blob: { dataUrl, mime: "image/gif" },
      },
    });
    ensure(invalidMime.status === 415, "bildirilen tür uyuşmazlığı 415");
    ensure(
      errorCode(invalidMime.data) === "UNSUPPORTED_MEDIA_TYPE",
      "415 kodu UNSUPPORTED_MEDIA_TYPE",
    );

    const plainTextAsImage = await api(`/api/chats/${chatAId}/messages`, {
      method: "POST",
      body: {
        sender: "Elif",
        body: "Sahte görsel",
        blob: {
          dataUrl: `data:image/png;base64,${Buffer.from("bu bir görsel değil").toString("base64")}`,
          mime: "image/png",
        },
      },
    });
    ensure(plainTextAsImage.status === 415, "sihirli bayt kontrolü geçersiz içeriği reddetti");

    const oversized = Buffer.alloc(MAX_BLOB_BYTES + 1);
    oversized.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const oversizedResponse = await api(`/api/chats/${chatAId}/messages`, {
      method: "POST",
      body: {
        sender: "Elif",
        body: "Çok büyük",
        blob: {
          dataUrl: `data:image/png;base64,${oversized.toString("base64")}`,
          mime: "image/png",
        },
      },
    });
    ensure(oversizedResponse.status === 413, "2 MB üstü görsel 413");
    ensure(
      errorCode(oversizedResponse.data) === "PAYLOAD_TOO_LARGE",
      "413 kodu PAYLOAD_TOO_LARGE",
    );

    const blobFile = join(blobsDir, blobId);
    ensure(existsSync(blobFile), "blob dosyası diskte var");

    const deleteFirst = await api(`/api/messages/${firstMessage.messageId}`, {
      method: "DELETE",
    });
    ensure(deleteFirst.status === 200, "ilk mesaj silme 200");
    const deleteFirstBody = deleteFirst.data as DeleteMessageResponse;
    ensure(deleteFirstBody.blobDeleted === false, "ilk silmede blob korunuyor");
    ensure(deleteFirstBody.refCount === 1, "ilk silmeden sonra refCount 1");
    ensure(existsSync(blobFile), "tek referans kalınca dosya diskte kalıyor");

    const blobStillThere = ctx.db
      .prepare("SELECT ref_count FROM blobs WHERE id = ?")
      .get(blobId) as { ref_count: number } | undefined;
    ensure(blobStillThere?.ref_count === 1, "blob satırı refCount 1 ile duruyor");

    const deleteSecond = await api(`/api/messages/${secondMessage.messageId}`, {
      method: "DELETE",
    });
    ensure(deleteSecond.status === 200, "ikinci mesaj silme 200");
    const deleteSecondBody = deleteSecond.data as DeleteMessageResponse;
    ensure(deleteSecondBody.blobDeleted === true, "son referansta blob silindi");
    ensure(deleteSecondBody.refCount === 0, "son silmede refCount 0");
    ensure(!existsSync(blobFile), "son referansta dosya diskten silindi");

    const finalBlob = ctx.db
      .prepare("SELECT COUNT(*) AS count FROM blobs")
      .get() as { count: number };
    ensure(finalBlob.count === 0, "blob tablosu temiz");

    const finalMetrics = (await api("/api/metrics")).data as MetricsResponse;
    ensure(finalMetrics.totalBlobs === 0, "final metrics totalBlobs 0");
    ensure(finalMetrics.bytesSaved === 0, "final metrics bytesSaved 0");
    ensure(finalMetrics.fetches24h === 0, "blob silinince fetch kayıtları temizlendi");

    const missingMessage = await api("/api/messages/999999", {
      method: "DELETE",
    });
    ensure(missingMessage.status === 404, "olmayan mesaj silme 404");

    // Rate limit is isolated on a second database so the main assertions above
    // are not affected by the shared 10/minute bucket.
    rateCtx = createContext({
      dbPath: join(tempDir, "rate.db"),
      blobsDir: join(tempDir, "rate-blobs"),
      allowedOrigins: [TEST_ORIGIN],
      isProduction: false,
    });
    const rateServer = await startTestServer(rateCtx);
    servers.push(rateServer.server);
    const rateApi = makeApi(rateServer.baseUrl);

    const rateChat = await rateApi("/api/chats", {
      method: "POST",
      body: { name: "Hız Testi" },
    });
    const rateChatId = (rateChat.data as { chat: { id: string } }).chat.id;

    for (let index = 1; index <= MESSAGE_RATE_LIMIT; index += 1) {
      const posted = await rateApi(`/api/chats/${rateChatId}/messages`, {
        method: "POST",
        body: { sender: "Test", body: `mesaj ${index}` },
      });
      ensure(posted.status === 201, `${index}. mesaj dakikalık sınır içinde 201`);
    }

    const limited = await rateApi(`/api/chats/${rateChatId}/messages`, {
      method: "POST",
      body: { sender: "Test", body: "sınırı aşan mesaj" },
    });
    ensure(limited.status === 429, "11. mesaj 429");
    ensure(errorCode(limited.data) === "RATE_LIMITED", "429 kodu RATE_LIMITED");
    ensure(limited.headers.get("retry-after") !== null, "429 Retry-After başlığı var");

    console.log("\nSmoke test başarılı.");
  } finally {
    for (const server of servers) {
      await closeTestServer(server);
    }
    ctx?.close();
    rateCtx?.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error("\nSmoke test başarısız:");
  console.error(error);
  process.exitCode = 1;
});
