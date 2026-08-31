import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ASSETS_DIR = path.resolve(DATA_DIR, 'assets');
const DB_PATH = path.resolve(DATA_DIR, 'vault.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

export const sqlite = new Database(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

export function initDatabase() {
  // 1. Create base tables if not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source_url TEXT,
      canonical_url TEXT,
      source_domain TEXT,
      content_text TEXT NOT NULL DEFAULT '',
      organization_status TEXT NOT NULL DEFAULT 'inbox',
      processing_status TEXT NOT NULL DEFAULT 'pending',
      favorite INTEGER NOT NULL DEFAULT 0,
      captured_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      sha256 TEXT,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      external_topic_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT 'stone',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_topics (
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (item_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (item_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS ingestion_logs (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      step TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);

  // 2. Setup SQLite FTS5 virtual table
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
      id UNINDEXED,
      title,
      description,
      content_text,
      source_url,
      tokenize='unicode61'
    );
  `);

  // 3. Setup Triggers to keep FTS5 synchronized
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
      INSERT INTO items_fts(id, title, description, content_text, source_url)
      VALUES (new.id, new.title, new.description, new.content_text, coalesce(new.source_url, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
      DELETE FROM items_fts WHERE id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
      DELETE FROM items_fts WHERE id = old.id;
      INSERT INTO items_fts(id, title, description, content_text, source_url)
      VALUES (new.id, new.title, new.description, new.content_text, coalesce(new.source_url, ''));
    END;
  `);

  console.log('[DB] Database and FTS5 initialized at', DB_PATH);
}

export { DATA_DIR, ASSETS_DIR, DB_PATH };
