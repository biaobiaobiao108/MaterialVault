import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initDatabase } from './db/db';
import { seed } from './db/seed';
import { itemsRouter } from './routes/items';
import { topicsRouter } from './routes/topics';
import { tagsRouter } from './routes/tags';
import { assetsRouter } from './routes/assets';
import { uploadsRouter } from './routes/uploads';
import { searchRouter } from './routes/search';
import { statsRouter } from './routes/stats';
import fs from 'fs';
import path from 'path';

// 1. Initialize SQLite database & FTS5
initDatabase();
seed().catch((err) => console.error('[Seed Initialization Warning]', err));

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// 2. Mount API Routes
app.route('/api/items', itemsRouter);
app.route('/api/topics', topicsRouter);
app.route('/api/tags', tagsRouter);
app.route('/api/assets', assetsRouter);
app.route('/api/uploads', uploadsRouter);
app.route('/api/search', searchRouter);
app.route('/api/stats', statsRouter);

// 3. Serve Frontend Static Assets if build exists
const DIST_DIR = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.get('/*', async (c) => {
    const reqPath = c.req.path;
    const requestedFilePath = path.join(DIST_DIR, reqPath);

    if (fs.existsSync(requestedFilePath) && fs.statSync(requestedFilePath).isFile()) {
      const file = Bun.file(requestedFilePath);
      return new Response(file);
    }

    // SPA Fallback
    const indexHtmlPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      const indexFile = Bun.file(indexHtmlPath);
      return new Response(indexFile, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return c.text('Not Found', 404);
  });
}

const PORT = parseInt(process.env.PORT || '3000', 10);
console.log(`[Material Vault Server] Running on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
