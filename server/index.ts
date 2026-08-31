import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { initDatabase } from './db';
import { error, json } from './utils';
import { isAuthRequired, validateToken } from './services/auth';
import {
  handleAuthStatus,
  handleAuthSetup,
  handleAuthLogin,
  handleAuthLogout,
  handleChangePassword,
  handleGetApiToken,
  handleResetApiToken,
} from './routes/auth';
import {
  handleGetItems,
  handleGetItem,
  handleCaptureUrl,
  handleCreateNote,
  handleUpdateItem,
  handleDeleteItem,
  handleRetryItem,
  handleBatchAction,
} from './routes/items';
import {
  handleGetTags,
  handleCreateTag,
  handleUpdateTag,
  handleDeleteTag,
  handleLinkTag,
  handleUnlinkTag,
} from './routes/tags';
import { handleSearch } from './routes/search';
import { handleUploads } from './routes/uploads';
import { handleGetAsset } from './routes/assets';
import { handleGetStats, handleBackup } from './routes/stats';

// Initialize DB schema & FTS5
initDatabase();

const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = join(process.cwd(), 'dist');
const PUBLIC_DIR = join(process.cwd(), 'public');

console.log(`[Material Vault] Starting native Bun server on http://localhost:${PORT}`);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token',
        },
      });
    }

    try {
      // -------------------------------------------------------------
      // 1. REST API Routes (/api/*)
      // -------------------------------------------------------------
      if (path.startsWith('/api')) {
        // Public Auth endpoints
        if (path === '/api/auth/status' && method === 'GET') return handleAuthStatus(req);
        if (path === '/api/auth/setup' && method === 'POST') return await handleAuthSetup(req);
        if (path === '/api/auth/login' && method === 'POST') return await handleAuthLogin(req);

        // Security Guard: Check token for all protected API routes
        const authHeader = req.headers.get('authorization') ||
                           req.headers.get('x-api-token') ||
                           url.searchParams.get('token');

        if (isAuthRequired() && !validateToken(authHeader)) {
          return error('未授权：请先登录', 401);
        }

        // Authenticated Auth sub-routes
        if (path === '/api/auth/logout' && method === 'POST') return handleAuthLogout(req);
        if (path === '/api/auth/change-password' && method === 'POST') return await handleChangePassword(req);
        if (path === '/api/auth/api-token' && method === 'GET') return handleGetApiToken();
        if (path === '/api/auth/reset-api-token' && method === 'POST') return handleResetApiToken();

        // Stats & Backup
        if (path === '/api/stats' && method === 'GET') return handleGetStats();
        if (path === '/api/backup' && method === 'GET') return handleBackup();

        // Search
        if (path === '/api/search' && method === 'GET') return handleSearch(req);

        // Uploads
        if (path === '/api/uploads' && method === 'POST') return await handleUploads(req);

        // Assets
        if (path.startsWith('/api/assets/')) {
          const assetId = path.replace('/api/assets/', '');
          if (method === 'GET') return handleGetAsset(assetId);
        }

        // Tags API
        if (path === '/api/tags') {
          if (method === 'GET') return handleGetTags();
          if (method === 'POST') return await handleCreateTag(req);
        }
        if (path.startsWith('/api/tags/')) {
          const tagId = path.replace('/api/tags/', '');
          if (method === 'PATCH') return await handleUpdateTag(tagId, req);
          if (method === 'DELETE') return handleDeleteTag(tagId);
        }

        // Items API
        if (path === '/api/items') {
          if (method === 'GET') return handleGetItems(req);
        }
        if (path === '/api/items/url' && method === 'POST') return await handleCaptureUrl(req);
        if (path === '/api/items/note' && method === 'POST') return await handleCreateNote(req);
        if (path === '/api/items/batch' && method === 'POST') return await handleBatchAction(req);

        // Item sub-routes: /api/items/:id/tags, /api/items/:id/retry, /api/items/:id
        const itemTagMatch = path.match(/^\/api\/items\/([^/]+)\/tags(?:\/([^/]+))?$/);
        if (itemTagMatch) {
          const itemId = itemTagMatch[1];
          const tagId = itemTagMatch[2];
          if (method === 'POST') return await handleLinkTag(itemId, req);
          if (method === 'DELETE' && tagId) return handleUnlinkTag(itemId, tagId);
        }

        const itemRetryMatch = path.match(/^\/api\/items\/([^/]+)\/retry$/);
        if (itemRetryMatch && method === 'POST') {
          return handleRetryItem(itemRetryMatch[1]);
        }

        const itemMatch = path.match(/^\/api\/items\/([^/]+)$/);
        if (itemMatch) {
          const itemId = itemMatch[1];
          if (method === 'GET') return handleGetItem(itemId);
          if (method === 'PATCH') return await handleUpdateItem(itemId, req);
          if (method === 'DELETE') return handleDeleteItem(itemId);
        }

        return error(`Not Found: ${method} ${path}`, 404);
      }

      // -------------------------------------------------------------
      // 2. Static Assets & SPA Fallback (dist/ or public/)
      // -------------------------------------------------------------
      // Direct file in dist
      const distFilePath = join(DIST_DIR, path);
      if (existsSync(distFilePath) && !path.endsWith('/')) {
        const file = Bun.file(distFilePath);
        return new Response(file);
      }

      // Direct file in public (e.g. logo.png)
      const publicFilePath = join(PUBLIC_DIR, path);
      if (existsSync(publicFilePath) && !path.endsWith('/')) {
        const file = Bun.file(publicFilePath);
        return new Response(file);
      }

      // SPA index.html fallback
      const indexHtmlPath = join(DIST_DIR, 'index.html');
      if (existsSync(indexHtmlPath)) {
        return new Response(Bun.file(indexHtmlPath), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      // Development mode welcome if dist is not built yet
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head><title>Material Vault</title></head>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #fafaf9; color: #1c1917;">
            <div style="text-align: center;">
              <h2>Material Vault Bun Server Running</h2>
              <p>请运行 <code>bun run build</code> 构建前端界面，或运行 <code>bun run dev:ui</code> 进行前端热更新调试。</p>
            </div>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    } catch (err: any) {
      console.error(`[Server Error] ${method} ${path}:`, err);
      return error(err.message || 'Internal Server Error', 500);
    }
  },
});
