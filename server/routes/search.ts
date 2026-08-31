import { searchItems } from '../services/search';
import { sqlite } from '../db/db';
import { json } from '../utils';

export async function handleSearch(req: Request, url: URL): Promise<Response> {
  if (req.method !== 'GET') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const q = url.searchParams.get('q') || undefined;
  const type = url.searchParams.get('type') || undefined;
  const status = (url.searchParams.get('status') as any) || undefined;
  const topicId = url.searchParams.get('topicId') || undefined;
  const tagId = url.searchParams.get('tagId') || undefined;
  const domain = url.searchParams.get('domain') || undefined;
  const favoriteParam = url.searchParams.get('favorite');
  const favorite = favoriteParam === 'true' ? true : favoriteParam === 'false' ? false : undefined;
  const startDateStr = url.searchParams.get('startDate');
  const endDateStr = url.searchParams.get('endDate');
  const startDate = startDateStr ? parseInt(startDateStr, 10) : undefined;
  const endDate = endDateStr ? parseInt(endDateStr, 10) : undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const results = searchItems({
    q,
    type,
    organizationStatus: status,
    topicId,
    tagId,
    domain,
    favorite,
    startDate,
    endDate,
    limit,
    offset,
  });

  const itemIds = results.map((r) => r.id);
  let topicsByItem: Record<string, any[]> = {};
  let tagsByItem: Record<string, any[]> = {};
  let assetsByItem: Record<string, any[]> = {};

  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => '?').join(',');
    const topicLinks = sqlite
      .prepare(
        `SELECT it.item_id, t.* FROM topics t JOIN item_topics it ON it.topic_id = t.id WHERE it.item_id IN (${placeholders})`
      )
      .all(...itemIds) as any[];
    topicLinks.forEach((t) => {
      if (!topicsByItem[t.item_id]) topicsByItem[t.item_id] = [];
      topicsByItem[t.item_id].push({ id: t.id, title: t.title, status: t.status });
    });

    const tagLinks = sqlite
      .prepare(
        `SELECT itg.item_id, tg.* FROM tags tg JOIN item_tags itg ON itg.tag_id = tg.id WHERE itg.item_id IN (${placeholders})`
      )
      .all(...itemIds) as any[];
    tagLinks.forEach((tg) => {
      if (!tagsByItem[tg.item_id]) tagsByItem[tg.item_id] = [];
      tagsByItem[tg.item_id].push({ id: tg.id, name: tg.name, color: tg.color });
    });

    const assetRows = sqlite
      .prepare(
        `SELECT id, item_id, kind, mime_type, file_name, file_size, storage_path, created_at FROM assets WHERE item_id IN (${placeholders})`
      )
      .all(...itemIds) as any[];
    assetRows.forEach((a) => {
      if (!assetsByItem[a.item_id]) assetsByItem[a.item_id] = [];
      assetsByItem[a.item_id].push(a);
    });
  }

  const enriched = results.map((r) => ({
    ...r,
    topics: topicsByItem[r.id] || [],
    tags: tagsByItem[r.id] || [],
    assets: assetsByItem[r.id] || [],
  }));

  return json({ items: enriched, count: enriched.length });
}
