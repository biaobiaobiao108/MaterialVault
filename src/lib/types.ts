export type ItemType = 'url' | 'note' | 'image' | 'document' | 'video';
export type OrganizationStatus = 'inbox' | 'organized' | 'archived';
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type AssetKind = 'screenshot' | 'markdown' | 'original' | 'thumbnail';

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  itemCount?: number;
  createdAt: number;
}

export interface Asset {
  id: string;
  itemId: string;
  kind: AssetKind;
  mimeType: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
  createdAt: number;
}

export interface IngestionLog {
  id: string;
  itemId: string;
  step: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  message: string;
  createdAt: number;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  description?: string | null;
  sourceUrl?: string | null;
  canonicalUrl?: string | null;
  sourceDomain?: string | null;
  contentText?: string | null;
  organizationStatus: OrganizationStatus;
  processingStatus: ProcessingStatus;
  favorite: boolean;
  capturedAt: number;
  createdAt: number;
  updatedAt: number;
  tags?: Tag[];
  assets?: Asset[];
  logs?: IngestionLog[];
}

export interface VaultStats {
  totalItems: number;
  inboxCount: number;
  organizedCount: number;
  archivedCount: number;
  favoriteCount: number;
  totalTags: number;
  assetCount: number;
  assetBytes: number;
  typeCounts?: { type: string; count: number }[];
  topDomains?: { domain: string; count: number }[];
}

export interface SearchParams {
  q?: string;
  type?: ItemType;
  status?: OrganizationStatus;
  tagId?: string;
  domain?: string;
  favorite?: boolean;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}
