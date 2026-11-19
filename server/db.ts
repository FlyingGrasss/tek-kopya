import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export type AppDatabase = Database.Database;

const DEFAULT_SCHEMA_PATH = resolve(process.cwd(), "server", "schema.sql");

/** Opens (and creates) the SQLite database from the checked-in schema. */
export function openDatabase(
  file: string,
  schemaPath: string = DEFAULT_SCHEMA_PATH,
): AppDatabase {
  mkdirSync(dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");

  const schema = readFileSync(schemaPath, "utf8");
  db.exec(schema);

  return db;
}
