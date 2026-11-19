import { mkdirSync, rmSync } from "node:fs";
import type { ImageMime } from "../shared/constants.js";
import { hashBytes, relativeBlobPath, writeBlobFile } from "./blobs.js";
import { resolveConfig } from "./config.js";
import { openDatabase, type AppDatabase } from "./db.js";
import { coffeeSeededPng, sharedSeededPng, sunsetSeededPng } from "./png.js";

const HOUR = 60 * 60 * 1000;

const CHATS = [
  { id: "seed_aile", name: "Aile" },
  { id: "seed_kamp", name: "Kamp 2026" },
  { id: "seed_tasarim", name: "Tasarım Ekibi" },
] as const;

interface SeedMessage {
  chatId: string;
  sender: string;
  body: string;
  image: "shared" | "sunset" | "coffee";
  createdAt: number;
}

function countRows(db: AppDatabase, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
    count: number;
  };
  return row.count;
}

function clearData(db: AppDatabase, blobsDir: string): void {
  db.exec(`
    DELETE FROM fetches;
    DELETE FROM messages;
    DELETE FROM chats;
    DELETE FROM blobs;
    DELETE FROM sqlite_sequence;
  `);
  rmSync(blobsDir, { recursive: true, force: true });
  mkdirSync(blobsDir, { recursive: true });
}

function insertBlob(
  db: AppDatabase,
  blobsDir: string,
  bytes: Buffer,
  mime: ImageMime,
  refCount: number,
  createdAt: number,
): string {
  const id = hashBytes(bytes);
  writeBlobFile(blobsDir, id, bytes);
  db.prepare(
    `INSERT INTO blobs (id, mime, size, ref_count, created_at, path)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, mime, bytes.length, refCount, createdAt, relativeBlobPath(id));
  return id;
}

function insertSeedData(db: AppDatabase, blobsDir: string, now: number): void {
  const shared = sharedSeededPng();
  const sunset = sunsetSeededPng();
  const coffee = coffeeSeededPng();
  const maxBytes = resolveConfig().maxBlobBytes;

  for (const [name, bytes] of [
    ["paylaşılan", shared],
    ["gün batımı", sunset],
    ["kahve", coffee],
  ] as const) {
    if (bytes.length > maxBytes) {
      throw new Error(`[seed] ${name} görseli 2 MB sınırını aşıyor.`);
    }
  }

  const createdAt = now - 8 * HOUR;
  CHATS.forEach((chat, index) => {
    db.prepare("INSERT INTO chats (id, name, created_at) VALUES (?, ?, ?)").run(
      chat.id,
      chat.name,
      createdAt + index * 10 * 60_000,
    );
  });

  const sharedId = insertBlob(db, blobsDir, shared, "image/png", 4, createdAt);
  const sunsetId = insertBlob(
    db,
    blobsDir,
    sunset,
    "image/png",
    1,
    createdAt + 1,
  );
  const coffeeId = insertBlob(
    db,
    blobsDir,
    coffee,
    "image/png",
    1,
    createdAt + 2,
  );

  const imageIds: Record<SeedMessage["image"], string> = {
    shared: sharedId,
    sunset: sunsetId,
    coffee: coffeeId,
  };

  const messages: SeedMessage[] = [
    {
      chatId: "seed_aile",
      sender: "Elif",
      body: "Bu fotoğrafı annem de istedi. Tek dosya olarak burada duruyor.",
      image: "shared",
      createdAt: now - 5 * HOUR,
    },
    {
      chatId: "seed_kamp",
      sender: "Mert",
      body: "Afiş kamp grubunda da lazım, aynı görseli buraya ekliyorum.",
      image: "shared",
      createdAt: now - 4 * HOUR - 30 * 60_000,
    },
    {
      chatId: "seed_tasarim",
      sender: "Zeynep",
      body: "Afişin son hali. Baskıya bunu gönderiyoruz.",
      image: "shared",
      createdAt: now - 4 * HOUR,
    },
    {
      chatId: "seed_aile",
      sender: "Elif",
      body: "Aynı görseli burada da paylaşıyorum; diskte ikinci kopya yok.",
      image: "shared",
      createdAt: now - 3 * HOUR - 30 * 60_000,
    },
    {
      chatId: "seed_kamp",
      sender: "Selin",
      body: "Dün akşamki gün batımı, manzara gerçekten güzeldi.",
      image: "sunset",
      createdAt: now - 3 * HOUR,
    },
    {
      chatId: "seed_tasarim",
      sender: "Can",
      body: "Kahve molası fotoğrafı. Bu da yalnızca bir kez yüklendi.",
      image: "coffee",
      createdAt: now - 2 * HOUR - 30 * 60_000,
    },
  ];

  const insertMessage = db.prepare(
    `INSERT INTO messages (chat_id, sender, body, blob_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const message of messages) {
    insertMessage.run(
      message.chatId,
      message.sender,
      message.body,
      imageIds[message.image],
      message.createdAt,
    );
  }

  const insertFetch = db.prepare(
    "INSERT INTO fetches (blob_id, user, created_at) VALUES (?, ?, ?)",
  );
  insertFetch.run(sharedId, "Elif", now - HOUR);
  insertFetch.run(sharedId, "Mert", now - 20 * 60_000);
}

interface SeedSummary {
  chats: number;
  messages: number;
  blobs: number;
  sharedRefs: number;
  bytesStored: number;
  bytesSaved: number;
}

function verifySeed(db: AppDatabase): SeedSummary {
  const aggregate = db
    .prepare(
      `SELECT
         COUNT(*) AS blobs,
         COALESCE(SUM(size), 0) AS bytes_stored,
         COALESCE(SUM(size * MAX(ref_count - 1, 0)), 0) AS bytes_saved
       FROM blobs`,
    )
    .get() as { blobs: number; bytes_stored: number; bytes_saved: number };

  const shared = db
    .prepare("SELECT ref_count FROM blobs ORDER BY ref_count DESC LIMIT 1")
    .get() as { ref_count: number } | undefined;

  const summary: SeedSummary = {
    chats: countRows(db, "chats"),
    messages: countRows(db, "messages"),
    blobs: aggregate.blobs,
    sharedRefs: shared?.ref_count ?? 0,
    bytesStored: aggregate.bytes_stored,
    bytesSaved: aggregate.bytes_saved,
  };

  if (
    summary.chats !== 3 ||
    summary.messages !== 6 ||
    summary.blobs !== 3 ||
    summary.sharedRefs !== 4 ||
    summary.bytesSaved <= 0
  ) {
    throw new Error(
      `[seed] Beklenen demo sayıları tutmadı: ${JSON.stringify(summary)}`,
    );
  }

  return summary;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("tr-TR")} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("tr-TR", {
    maximumFractionDigits: 1,
  })} MB`;
}

function printSummary(summary: SeedSummary): void {
  console.log("[seed] Tek Kopya demo verisi hazır.");
  console.log(
    `[seed] ${summary.chats} sohbet, ${summary.messages} mesaj, ${summary.blobs} benzersiz dosya`,
  );
  console.log(
    `[seed] Paylaşılan görsel ${summary.sharedRefs} kez bağlı; diskte ${formatBytes(
      summary.bytesStored,
    )}, kazanılan ${formatBytes(summary.bytesSaved)}.`,
  );
  console.log("[seed] Web: http://localhost:3000");
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const reset = args.has("--reset");
  const ifEmpty = args.has("--if-empty");
  const config = resolveConfig();

  if (reset && config.isProduction) {
    console.error("[seed] --reset üretim ortamında reddedildi.");
    process.exitCode = 1;
    return;
  }

  const db = openDatabase(config.dbPath);
  try {
    const existing = countRows(db, "chats");
    if (!reset && existing > 0) {
      if (ifEmpty) {
        console.log("[seed] Sohbetler mevcut; --if-empty nedeniyle atlandı.");
        return;
      }
      throw new Error(
        "Veritabanında sohbet var. Temiz demo için `pnpm seed:reset` çalıştır.",
      );
    }

    const summary = db.transaction(() => {
      clearData(db, config.blobsDir);
      insertSeedData(db, config.blobsDir, Date.now());
      return verifySeed(db);
    })();

    printSummary(summary);
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[seed] Hata: ${message}`);
  process.exitCode = 1;
});
