package db

import (
	"database/sql"
	"fmt"
	"log"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDatabase(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// SQLite connection settings
	db.SetMaxOpenConns(1) // SQLite single writer optimization

	// Enable WAL & Foreign Keys
	if _, err := db.Exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`); err != nil {
		return nil, fmt.Errorf("failed to set pragma: %w", err)
	}

	// Create base tables
	schemaSQL := `
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

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT 'stone',
      created_at INTEGER NOT NULL
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
	`

	if _, err := db.Exec(schemaSQL); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	// Setup FTS5 virtual table
	ftsSQL := `
    CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
      id UNINDEXED,
      title,
      description,
      content_text,
      source_url,
      tokenize='unicode61'
    );
	`
	if _, err := db.Exec(ftsSQL); err != nil {
		return nil, fmt.Errorf("failed to create fts5 table: %w", err)
	}

	// Setup triggers
	triggersSQL := `
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
	`
	if _, err := db.Exec(triggersSQL); err != nil {
		return nil, fmt.Errorf("failed to create triggers: %w", err)
	}

	DB = db
	log.Printf("[DB] Database and FTS5 initialized at %s", dbPath)
	return db, nil
}
