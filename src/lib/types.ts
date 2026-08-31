export type ItemType = 'url' | 'image' | 'video' | 'document' | 'note';
export type OrganizationStatus = 'inbox' | 'organized' | 'archived';
export type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
export type AssetKind = 'original' | 'screenshot' | 'html' | 'markdown' | 'pdf' | 'thumbnail';

export interface Asset {
  id: string;
  itemId: string;
  kind: AssetKind;
  mimeType: string;
  fileName: string;
  fileSize: number;
  sha256?: string;
  storagePath: string;
  createdAt: number;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
  externalTopicId?: string | null;
  createdAt: number;
  updatedAt: number;
  itemCount?: number;
  items?: Item[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  itemCount?: number;
}

export interface IngestionLog {
  id: string;
  itemId: string;
  step: string;
  status: 'pending' | 'success' | 'failed';
  message: string;
  createdAt: number;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  sourceUrl?: string | null;
  canonicalUrl?: string | null;
  sourceDomain?: string | null;
  contentText: string;
  organizationStatus: OrganizationStatus;
  processingStatus: ProcessingStatus;
  favorite: boolean;
  capturedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  topics?: Topic[];
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
  totalTopics: number;
  totalTags: number;
  assetCount: number;
  assetBytes: number;
  typeCounts: { type: ItemType; count: number }[];
  topDomains: { domain: string; count: number }[];
}
