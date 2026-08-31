import { db } from '../db';

export function isAuthRequired(): boolean {
  if (process.env.AUTH_PASSWORD && process.env.AUTH_PASSWORD.trim().length > 0) {
    return true;
  }
  const row: any = db.prepare(`SELECT value FROM settings WHERE key = 'password_hash'`).get();
  return Boolean(row?.value);
}

export function isPasswordSet(): boolean {
  if (process.env.AUTH_PASSWORD && process.env.AUTH_PASSWORD.trim().length > 0) {
    return true;
  }
  const row: any = db.prepare(`SELECT value FROM settings WHERE key = 'password_hash'`).get();
  return Boolean(row?.value);
}

export async function verifyPassword(password: string): Promise<boolean> {
  const envPassword = process.env.AUTH_PASSWORD?.trim();
  if (envPassword) {
    return password === envPassword;
  }

  const row: any = db.prepare(`SELECT value FROM settings WHERE key = 'password_hash'`).get();
  if (!row?.value) return false;

  try {
    return await Bun.password.verify(password, row.value);
  } catch (err) {
    console.error('[Auth] Password verification error:', err);
    return false;
  }
}

export async function setPassword(newPassword: string): Promise<void> {
  const hash = await Bun.password.hash(newPassword);
  const now = Date.now();

  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('password_hash', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(hash, now);

  // Ensure API Token exists
  const existingToken: any = db.prepare(`SELECT value FROM settings WHERE key = 'api_token'`).get();
  if (!existingToken) {
    generateApiToken();
  }
}

export function getApiToken(): string {
  const row: any = db.prepare(`SELECT value FROM settings WHERE key = 'api_token'`).get();
  if (row?.value) return row.value;
  return generateApiToken();
}

export function generateApiToken(): string {
  const token = `mv_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('api_token', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(token, now);

  return token;
}

export function createSession(): { token: string; expiresAt: number } {
  const token = `mvs_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
  const id = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 3600 * 1000; // 30 days

  db.prepare(`
    INSERT INTO sessions (id, token, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(id, token, now, expiresAt);

  return { token, expiresAt };
}

export function validateToken(tokenStr: string | null | undefined): boolean {
  if (!isAuthRequired()) return true;
  if (!tokenStr) return false;

  const clean = tokenStr.replace(/^Bearer\s+/i, '').trim();
  if (!clean) return false;

  // 1. Check permanent API token
  const apiTokenRow: any = db.prepare(`SELECT value FROM settings WHERE key = 'api_token'`).get();
  if (apiTokenRow?.value && clean === apiTokenRow.value) {
    return true;
  }

  // 2. Check active sessions
  const sessionRow: any = db.prepare(`
    SELECT id, expires_at FROM sessions WHERE token = ?
  `).get(clean);

  if (sessionRow && sessionRow.expires_at > Date.now()) {
    return true;
  }

  return false;
}

export function revokeSession(tokenStr: string): void {
  const clean = tokenStr.replace(/^Bearer\s+/i, '').trim();
  if (clean) {
    db.prepare(`DELETE FROM sessions WHERE token = ?`).run(clean);
  }
}
