import { Database } from 'bun:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'vault.db');
export const ASSETS_DIR = join(DATA_DIR, 'assets');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}
if (!existsSync(ASSETS_DIR)) {
  mkdirSync(ASSETS_DIR, { recursive: true });
}

export const db = new Database(DB_PATH, { create: true });

// Optimize SQLite for high performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      source_url TEXT,
      canonical_url TEXT,
      source_domain TEXT,
      content_text TEXT,
      organization_status TEXT NOT NULL DEFAULT 'inbox',
      processing_status TEXT NOT NULL DEFAULT 'ready',
      favorite INTEGER NOT NULL DEFAULT 0,
      captured_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (item_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS processing_logs (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      error_detail TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    -- Indices for high performance queries
    CREATE INDEX IF NOT EXISTS idx_items_org_status ON items(organization_status);
    CREATE INDEX IF NOT EXISTS idx_items_proc_status ON items(processing_status);
    CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_items_favorite ON items(favorite);
    CREATE INDEX IF NOT EXISTS idx_assets_item_id ON assets(item_id);
    CREATE INDEX IF NOT EXISTS idx_assets_sha256 ON assets(sha256);
    CREATE INDEX IF NOT EXISTS idx_logs_item_id ON processing_logs(item_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

    -- FTS5 Full Text Search Table
    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
      title,
      description,
      content_text,
      source_url,
      tokenize = 'unicode61'
    );
  `);

  // Setup FTS5 Triggers
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
      INSERT INTO items_fts(rowid, title, description, content_text, source_url)
      VALUES (new.rowid, new.title, coalesce(new.description, ''), coalesce(new.content_text, ''), coalesce(new.source_url, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
      INSERT INTO items_fts(items_fts, rowid, title, description, content_text, source_url)
      VALUES ('delete', old.rowid, old.title, coalesce(old.description, ''), coalesce(old.content_text, ''), coalesce(old.source_url, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
      INSERT INTO items_fts(items_fts, rowid, title, description, content_text, source_url)
      VALUES ('delete', old.rowid, old.title, coalesce(old.description, ''), coalesce(old.content_text, ''), coalesce(old.source_url, ''));
      INSERT INTO items_fts(rowid, title, description, content_text, source_url)
      VALUES (new.rowid, new.title, coalesce(new.description, ''), coalesce(new.content_text, ''), coalesce(new.source_url, ''));
    END;
  `);

  console.log(`[DB] Database initialized at ${DB_PATH}`);
}
