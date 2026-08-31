import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['url', 'note', 'image', 'document', 'video'] }).notNull(),
  title: text('title').notNull(),
  description: text('description').default(''),
  sourceUrl: text('source_url'),
  canonicalUrl: text('canonical_url'),
  sourceDomain: text('source_domain'),
  contentText: text('content_text').default(''),
  organizationStatus: text('organization_status', { enum: ['inbox', 'organized', 'archived'] })
    .default('inbox')
    .notNull(),
  processingStatus: text('processing_status', { enum: ['pending', 'processing', 'ready', 'failed'] })
    .default('pending')
    .notNull(),
  favorite: integer('favorite', { mode: 'boolean' }).default(false).notNull(),
  capturedAt: integer('captured_at').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('stone'),
  createdAt: integer('created_at').notNull(),
});

export const itemTags = sqliteTable('item_tags', {
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
}));

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['screenshot', 'markdown', 'original', 'thumbnail'] }).notNull(),
  mimeType: text('mime_type').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  storagePath: text('storage_path').notNull(),
  sha256: text('sha256').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const ingestionLogs = sqliteTable('ingestion_logs', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  step: text('step').notNull(),
  status: text('status', { enum: ['pending', 'running', 'success', 'failed'] }).notNull(),
  message: text('message').notNull(),
  createdAt: integer('created_at').notNull(),
});

export type Item = typeof items.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type IngestionLog = typeof ingestionLogs.$inferSelect;
