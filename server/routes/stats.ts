import { sqlite } from '../db/db';
import { json } from '../utils';

export async function handleStats(req: Request, url: URL): Promise<Response> {
  if (req.method !== 'GET') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const totalItems = (sqlite.prepare(`SELECT COUNT(*) as count FROM items`).get() as any).count;
  const inboxCount = (sqlite.prepare(`SELECT COUNT(*) as count FROM items WHERE organization_status = 'inbox'`).get() as any).count;
  const organizedCount = (sqlite.prepare(`SELECT COUNT(*) as count FROM items WHERE organization_status = 'organized'`).get() as any).count;
  const archivedCount = (sqlite.prepare(`SELECT COUNT(*) as count FROM items WHERE organization_status = 'archived'`).get() as any).count;
  const favoriteCount = (sqlite.prepare(`SELECT COUNT(*) as count FROM items WHERE favorite = 1`).get() as any).count;

  const totalTopics = (sqlite.prepare(`SELECT COUNT(*) as count FROM topics`).get() as any).count;
  const totalTags = (sqlite.prepare(`SELECT COUNT(*) as count FROM tags`).get() as any).count;
  const totalAssets = (sqlite.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as totalBytes FROM assets`).get() as any);

  const typeCounts = sqlite.prepare(`SELECT type, COUNT(*) as count FROM items GROUP BY type`).all() as any[];
  const domainCounts = sqlite.prepare(`SELECT source_domain as domain, COUNT(*) as count FROM items WHERE source_domain IS NOT NULL GROUP BY source_domain ORDER BY count DESC LIMIT 10`).all() as any[];

  return json({
    totalItems,
    inboxCount,
    organizedCount,
    archivedCount,
    favoriteCount,
    totalTopics,
    totalTags,
    assetCount: totalAssets.count,
    assetBytes: totalAssets.totalBytes,
    typeCounts,
    topDomains: domainCounts,
  });
}
