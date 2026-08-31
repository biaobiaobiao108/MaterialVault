import { Item, Tag, VaultStats, SearchParams } from './types';

const API_BASE = '/api';
const TOKEN_KEY = 'mv_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export interface AuthStatus {
  requireAuth: boolean;
  isSetup: boolean;
  authenticated: boolean;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMsg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData.error) errorMsg = errData.error;
    } catch (_) {}

    if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/status')) {
      removeAuthToken();
      window.dispatchEvent(new CustomEvent('mv-auth-required'));
    }

    throw new Error(errorMsg);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  getAuthStatus: () => fetchJson<AuthStatus>(`${API_BASE}/auth/status`),
  setupAuth: (password: string) =>
    fetchJson<{ message: string; token: string; expiresAt: number; apiToken: string }>(
      `${API_BASE}/auth/setup`,
      {
        method: 'POST',
        body: JSON.stringify({ password }),
      }
    ),
  login: (password: string) =>
    fetchJson<{ token: string; expiresAt: number }>(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () =>
    fetchJson<{ success: boolean }>(`${API_BASE}/auth/logout`, {
      method: 'POST',
    }),
  changePassword: (data: { oldPassword?: string; newPassword: string }) =>
    fetchJson<{ message: string }>(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getApiToken: () => fetchJson<{ apiToken: string }>(`${API_BASE}/auth/api-token`),
  resetApiToken: () =>
    fetchJson<{ apiToken: string; message: string }>(`${API_BASE}/auth/reset-api-token`, {
      method: 'POST',
    }),

  // Stats & Backup
  getStats: () => fetchJson<VaultStats>(`${API_BASE}/stats`),
  backupUrl: `${API_BASE}/backup`,

  // Items
  getItems: (params?: { status?: string; type?: string; favorite?: boolean; tagId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.favorite) query.set('favorite', 'true');
    if (params?.tagId) query.set('tagId', params.tagId);
    return fetchJson<{ items: Item[] }>(`${API_BASE}/items?${query.toString()}`);
  },

  getItem: (id: string) => fetchJson<{ item: Item }>(`${API_BASE}/items/${id}`),

  captureUrl: (data: { url: string; title?: string; description?: string; tagIds?: string[] }) =>
    fetchJson<{ item: Item; isDuplicate: boolean }>(`${API_BASE}/items/url`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createNote: (data: { title?: string; content: string; tagIds?: string[] }) =>
    fetchJson<{ item: Item }>(`${API_BASE}/items/note`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateItem: (id: string, updates: Partial<Item>) =>
    fetchJson<{ item: Item }>(`${API_BASE}/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteItem: (id: string) =>
    fetchJson<{ success: boolean; id: string }>(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
    }),

  retryIngestion: (id: string) =>
    fetchJson<{ message: string }>(`${API_BASE}/items/${id}/retry`, {
      method: 'POST',
    }),

  batchAction: (data: {
    itemIds: string[];
    action: 'set_status' | 'add_tag' | 'remove_tag' | 'favorite' | 'unfavorite' | 'delete';
    status?: string;
    tagId?: string;
  }) =>
    fetchJson<{ success: boolean; count: number }>(`${API_BASE}/items/batch`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Tags
  getTags: () => fetchJson<{ tags: Tag[] }>(`${API_BASE}/tags`),

  createTag: (name: string, color?: string) =>
    fetchJson<{ tag: Tag }>(`${API_BASE}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),

  updateTag: (id: string, data: { name?: string; color?: string }) =>
    fetchJson<{ tag: Tag }>(`${API_BASE}/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteTag: (id: string) =>
    fetchJson<{ success: boolean; id: string }>(`${API_BASE}/tags/${id}`, {
      method: 'DELETE',
    }),

  linkTag: (itemId: string, data: { tagId?: string; tagName?: string }) =>
    fetchJson<{ item: Item }>(`${API_BASE}/items/${itemId}/tags`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  unlinkTag: (itemId: string, tagId: string) =>
    fetchJson<{ item: Item }>(`${API_BASE}/items/${itemId}/tags/${tagId}`, {
      method: 'DELETE',
    }),

  // Search
  search: (params: SearchParams) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.type) query.set('type', params.type);
    if (params.status) query.set('status', params.status);
    if (params.tagId) query.set('tagId', params.tagId);
    if (params.domain) query.set('domain', params.domain);
    if (params.favorite !== undefined) query.set('favorite', String(params.favorite));
    if (params.startDate) query.set('startDate', String(params.startDate));
    if (params.endDate) query.set('endDate', String(params.endDate));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    return fetchJson<{ items: Item[]; count: number }>(`${API_BASE}/search?${query.toString()}`);
  },

  // Uploads
  uploadFiles: async (formData: FormData): Promise<{ items: Item[] }> => {
    const token = getAuthToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      let errorMsg = `Upload failed: ${res.status}`;
      try {
        const err = await res.json();
        if (err.error) errorMsg = err.error;
      } catch (_) {}

      if (res.status === 401) {
        removeAuthToken();
        window.dispatchEvent(new CustomEvent('mv-auth-required'));
      }

      throw new Error(errorMsg);
    }

    return res.json();
  },
};
