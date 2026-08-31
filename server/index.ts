import { initDatabase } from './db/db';
import { seed } from './db/seed';
import { handleItems } from './routes/items';
import { handleTags } from './routes/tags';
import { handleAssets } from './routes/assets';
import { handleUploads } from './routes/uploads';
import { handleSearch } from './routes/search';
import { handleStats } from './routes/stats';
import { json, corsOptions } from './utils';
import fs from 'fs';
import path from 'path';

// 1. Initialize SQLite database & FTS5
initDatabase();
seed().catch((err) => console.error('[Seed Initialization Warning]', err));

const DIST_DIR = path.resolve(process.cwd(), 'dist');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const PORT = parseInt(process.env.PORT || '3000', 10);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
      return corsOptions();
    }

    // 2. API Routes
    if (pathname.startsWith('/api/')) {
      const apiPath = pathname.slice(5); // Remove '/api/'

      try {
        if (apiPath.startsWith('items')) {
          const sub = apiPath.slice(5).replace(/^\//, ''); // e.g. '', 'url', 'note', ':id'
          return await handleItems(req, url, sub);
        }

        if (apiPath.startsWith('tags')) {
          const sub = apiPath.slice(4).replace(/^\//, '');
          return await handleTags(req, url, sub);
        }

        if (apiPath.startsWith('assets/')) {
          const assetId = apiPath.slice(7);
          return await handleAssets(req, url, assetId);
        }

        if (apiPath === 'uploads') {
          return await handleUploads(req);
        }

        if (apiPath === 'search') {
          return await handleSearch(req, url);
        }

        if (apiPath === 'stats') {
          return await handleStats(req, url);
        }

        return json({ error: 'API route not found' }, 404);
      } catch (err: any) {
        console.error(`[Server Error] ${req.method} ${pathname}:`, err);
        return json({ error: err?.message || 'Internal Server Error' }, 500);
      }
    }

    // 3. Static Files from dist/ or public/
    const publicFilePath = path.join(PUBLIC_DIR, pathname);
    if (fs.existsSync(publicFilePath) && fs.statSync(publicFilePath).isFile()) {
      return new Response(Bun.file(publicFilePath));
    }

    const distFilePath = path.join(DIST_DIR, pathname);
    if (fs.existsSync(distFilePath) && fs.statSync(distFilePath).isFile()) {
      return new Response(Bun.file(distFilePath));
    }

    // SPA fallback: dist/index.html
    const indexHtmlPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      return new Response(Bun.file(indexHtmlPath), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response('Material Vault Server Running', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
});

console.log(`[Material Vault Pure Bun Server] Running on http://localhost:${server.port}`);

export default server;
