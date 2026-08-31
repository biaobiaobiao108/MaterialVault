import { Item, Topic, Tag, VaultStats, OrganizationStatus, ItemType } from './types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `请求失败 (${res.status})`;
    try {
      const errData = await res.json();
      if (errData.error) errorMsg = errData.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Items
  getItems: async (params?: {
    status?: OrganizationStatus;
    type?: ItemType;
    topicId?: string;
    tagId?: string;
    favorite?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Item[] }> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.topicId) searchParams.set('topicId', params.topicId);
    if (params?.tagId) searchParams.set('tagId', params.tagId);
    if (params?.favorite !== undefined) searchParams.set('favorite', String(params.favorite));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    return fetchJson(`${API_BASE}/items?${searchParams.toString()}`);
  },

  getItem: async (id: string): Promise<{ item: Item }> => {
    return fetchJson(`${API_BASE}/items/${id}`);
  },

  captureUrl: async (data: {
    url: string;
    title?: string;
    description?: string;
    topicIds?: string[];
    tagIds?: string[];
  }): Promise<{ item: Item; isDuplicate?: boolean }> => {
    return fetchJson(`${API_BASE}/items/url`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createNote: async (data: {
    title?: string;
    content: string;
    topicIds?: string[];
    tagIds?: string[];
  }): Promise<{ item: Item }> => {
    return fetchJson(`${API_BASE}/items/note`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateItem: async (
    id: string,
    data: {
      title?: string;
      description?: string;
      contentText?: string;
      organizationStatus?: OrganizationStatus;
      favorite?: boolean;
    }
  ): Promise<{ item: Item }> => {
    return fetchJson(`${API_BASE}/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteItem: async (id: string): Promise<{ success: boolean; id: string }> => {
    return fetchJson(`${API_BASE}/items/${id}`, {
      method: 'DELETE',
    });
  },

  retryIngestion: async (id: string): Promise<{ message: string }> => {
    return fetchJson(`${API_BASE}/items/${id}/retry`, {
      method: 'POST',
    });
  },

  batchItems: async (data: {
    itemIds: string[];
    action: 'set_status' | 'add_topic' | 'remove_topic' | 'add_tag' | 'remove_tag' | 'favorite' | 'unfavorite' | 'delete';
    status?: OrganizationStatus;
    topicId?: string;
    tagId?: string;
  }): Promise<{ success: boolean; count: number }> => {
    return fetchJson(`${API_BASE}/items/batch`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  linkTopic: async (itemId: string, topicId: string): Promise<{ item: Item }> => {
    return fetchJson(`${API_BASE}/items/${itemId}/topics`, {
      method: 'POST',
      body: JSON.stringify({ topicId }),
    });
  },

  unlinkTopic: async (itemId: string, topicId: string): Promise<{ item: Item }> => {
    return fetchJson(`${API_BASE}/items/${itemId}/topics/${topicId}`, {
      method: 'DELETE',
    });
  },

  linkTag: async (itemId: string, tagData: { tagId?: string; tagName?: string }): Promise<{ item: Item }> => {
    return fetchJson(`${API_BASE}/items/${itemId}/tags`, {
      method: 'POST',
      body: JSON.stringify(tagData),
    });
  },

  unlinkTag: async (itemId: string, tagId: string): Promise<{ item: Item }> => {
    return fetchJson(`${API_BASE}/items/${itemId}/tags/${tagId}`, {
      method: 'DELETE',
    });
  },

  // Uploads
  uploadFiles: async (formData: FormData): Promise<{ items: Item[] }> => {
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || '上传失败');
    }
    return res.json();
  },

  // Topics
  getTopics: async (status?: 'active' | 'archived'): Promise<{ topics: Topic[] }> => {
    const q = status ? `?status=${status}` : '';
    return fetchJson(`${API_BASE}/topics${q}`);
  },

  getTopic: async (id: string): Promise<{ topic: Topic }> => {
    return fetchJson(`${API_BASE}/topics/${id}`);
  },

  createTopic: async (data: { title: string; description?: string; externalTopicId?: string }): Promise<{ topic: Topic }> => {
    return fetchJson(`${API_BASE}/topics`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateTopic: async (
    id: string,
    data: { title?: string; description?: string; status?: 'active' | 'archived'; externalTopicId?: string | null }
  ): Promise<{ topic: Topic }> => {
    return fetchJson(`${API_BASE}/topics/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteTopic: async (id: string): Promise<{ success: boolean; id: string }> => {
    return fetchJson(`${API_BASE}/topics/${id}`, {
      method: 'DELETE',
    });
  },

  getTopicExport: async (id: string, format: 'markdown' | 'excalidraw' = 'markdown'): Promise<any> => {
    const res = await fetch(`${API_BASE}/topics/${id}/export?format=${format}`);
    if (!res.ok) throw new Error('导出失败');
    if (format === 'markdown') {
      return res.text();
    }
    return res.json();
  },

  // Tags
  getTags: async (): Promise<{ tags: Tag[] }> => {
    return fetchJson(`${API_BASE}/tags`);
  },

  createTag: async (data: { name: string; color?: string }): Promise<{ tag: Tag }> => {
    return fetchJson(`${API_BASE}/tags`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteTag: async (id: string): Promise<{ success: boolean; id: string }> => {
    return fetchJson(`${API_BASE}/tags/${id}`, {
      method: 'DELETE',
    });
  },

  // Search
  search: async (params: {
    q?: string;
    type?: ItemType;
    status?: OrganizationStatus;
    topicId?: string;
    tagId?: string;
    domain?: string;
    favorite?: boolean;
    startDate?: number;
    endDate?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Item[]; count: number }> => {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.type) searchParams.set('type', params.type);
    if (params.status) searchParams.set('status', params.status);
    if (params.topicId) searchParams.set('topicId', params.topicId);
    if (params.tagId) searchParams.set('tagId', params.tagId);
    if (params.domain) searchParams.set('domain', params.domain);
    if (params.favorite !== undefined) searchParams.set('favorite', String(params.favorite));
    if (params.startDate) searchParams.set('startDate', String(params.startDate));
    if (params.endDate) searchParams.set('endDate', String(params.endDate));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.offset) searchParams.set('offset', String(params.offset));

    return fetchJson(`${API_BASE}/search?${searchParams.toString()}`);
  },

  // Stats
  getStats: async (): Promise<VaultStats> => {
    return fetchJson(`${API_BASE}/stats`);
  },
};
