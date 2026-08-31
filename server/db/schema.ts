import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['url', 'image', 'video', 'document', 'note'] }).notNull(),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  sourceUrl: text('source_url'),
  canonicalUrl: text('canonical_url'),
  sourceDomain: text('source_domain'),
  contentText: text('content_text').default('').notNull(),
  organizationStatus: text('organization_status', { enum: ['inbox', 'organized', 'archived'] }).default('inbox').notNull(),
  processingStatus: text('processing_status', { enum: ['pending', 'processing', 'ready', 'failed'] }).default('pending').notNull(),
  favorite: integer('favorite', { mode: 'boolean' }).default(false).notNull(),
  capturedAt: integer('captured_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['original', 'screenshot', 'html', 'markdown', 'pdf', 'thumbnail'] }).notNull(),
  mimeType: text('mime_type').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size').notNull(),
  sha256: text('sha256'),
  storagePath: text('storage_path').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const topics = sqliteTable('topics', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  status: text('status', { enum: ['active', 'archived'] }).default('active').notNull(),
  externalTopicId: text('external_topic_id'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('stone').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const itemTopics = sqliteTable('item_topics', {
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.topicId] }),
}));

export const itemTags = sqliteTable('item_tags', {
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
}));

export const ingestionLogs = sqliteTable('ingestion_logs', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  step: text('step').notNull(),
  status: text('status', { enum: ['pending', 'success', 'failed'] }).notNull(),
  message: text('message').default('').notNull(),
  createdAt: integer('created_at').notNull(),
});
