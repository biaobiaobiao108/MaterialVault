export function json(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...headers,
    },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

export function cleanUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    // Remove UTM tracking params and common marketing tags
    const dropPrefixes = ['utm_', 'spm_id_from', 'from_source', 'vd_source', 'fbclid', 'gclid'];
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (dropPrefixes.some((p) => key.startsWith(p))) {
        parsed.searchParams.delete(key);
      }
    }
    return parsed.toString();
  } catch (_) {
    return urlStr;
  }
}

export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu);
  if (!matches) return [];
  const set = new Set<string>();
  for (const m of matches) {
    const tag = m.trim().replace(/^#/, '').trim();
    if (tag) set.add(tag);
  }
  return Array.from(set);
}
