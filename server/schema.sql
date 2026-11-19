PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA user_version = 1;

CREATE TABLE IF NOT EXISTS blobs (
  id TEXT PRIMARY KEY CHECK (length(id) = 64),
  mime TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  ref_count INTEGER NOT NULL DEFAULT 0 CHECK (ref_count >= 0),
  created_at INTEGER NOT NULL,
  path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 1 AND 48),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (length(sender) BETWEEN 1 AND 32),
  body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  blob_id TEXT REFERENCES blobs(id) ON DELETE RESTRICT,
  created_at INTEGER NOT NULL,
  CHECK (length(body) > 0 OR blob_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_blob_id ON messages(blob_id);

CREATE TABLE IF NOT EXISTS fetches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob_id TEXT NOT NULL REFERENCES blobs(id) ON DELETE CASCADE,
  user TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fetches_created_at ON fetches(created_at);
CREATE INDEX IF NOT EXISTS idx_fetches_blob_id ON fetches(blob_id);
