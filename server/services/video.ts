export interface VideoInfo {
  platform: 'bilibili' | 'youtube';
  videoId: string;
  originalUrl: string;
}

export interface VideoMetadata {
  title: string;
  description: string;
  author: string;
  duration: number; // in seconds
  coverData?: Uint8Array;
  coverMime?: string;
  coverFileName?: string;
}

export async function detectVideoInfo(targetUrl: string): Promise<VideoInfo | null> {
  try {
    let urlStr = targetUrl.trim();

    // Resolve b23.tv short links
    if (urlStr.includes('b23.tv')) {
      try {
        const headRes = await fetch(urlStr, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        urlStr = headRes.url;
      } catch (_) {}
    }

    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    // Bilibili
    if (host.includes('bilibili.com')) {
      const bvMatch = path.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
      if (bvMatch) {
        return {
          platform: 'bilibili',
          videoId: bvMatch[1],
          originalUrl: urlStr,
        };
      }
    }

    // YouTube
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let videoId = '';
      if (host.includes('youtu.be')) {
        videoId = path.replace(/^\//, '').split('/')[0].split('?')[0];
      } else if (path.includes('/watch')) {
        videoId = parsed.searchParams.get('v') || '';
      } else if (path.includes('/shorts/') || path.includes('/embed/')) {
        const parts = path.split('/').filter(Boolean);
        videoId = parts[parts.length - 1];
      }

      if (videoId) {
        return {
          platform: 'youtube',
          videoId,
          originalUrl: urlStr,
        };
      }
    }

    return null;
  } catch (_) {
    return null;
  }
}

export async function fetchVideoMetadata(info: VideoInfo): Promise<VideoMetadata> {
  if (info.platform === 'bilibili') {
    return fetchBilibiliMeta(info.videoId);
  }
  return fetchYouTubeMeta(info.videoId, info.originalUrl);
}

async function fetchBilibiliMeta(bvid: string): Promise<VideoMetadata> {
  const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.bilibili.com/',
    },
  });

  if (!res.ok) {
    throw new Error(`Bilibili API failed: HTTP ${res.status}`);
  }

  const json: any = await res.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(`Bilibili API error: ${json.message || 'code ' + json.code}`);
  }

  const data = json.data;
  const title = data.title || bvid;
  const description = data.desc || '';
  const author = data.owner?.name || '';
  const duration = data.duration || 0;
  let picUrl: string = data.pic || '';

  if (picUrl.startsWith('//')) {
    picUrl = 'https:' + picUrl;
  } else if (picUrl.startsWith('http://')) {
    picUrl = 'https://' + picUrl.slice(7);
  }

  let coverData: Uint8Array | undefined;
  let coverMime = 'image/jpeg';

  if (picUrl) {
    try {
      const imgRes = await fetch(picUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://www.bilibili.com/',
        },
      });
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        coverData = new Uint8Array(buf);
        coverMime = imgRes.headers.get('content-type') || 'image/jpeg';
      }
    } catch (err) {
      console.warn(`[Video] Failed to download Bilibili cover: ${err}`);
    }
  }

  return {
    title,
    description,
    author,
    duration,
    coverData,
    coverMime,
    coverFileName: `bilibili_${bvid}.jpg`,
  };
}

async function fetchYouTubeMeta(videoId: string, originalUrl: string): Promise<VideoMetadata> {
  let title = `YouTube 视频 (${videoId})`;
  let author = '';

  // 1. Fetch metadata via official oEmbed
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data: any = await res.json();
      if (data.title) title = data.title;
      if (data.author_name) author = data.author_name;
    }
  } catch (_) {}

  // 2. Try fetching highest-resolution official cover
  // Priority: maxresdefault (1080P/720P) -> sddefault -> hqdefault
  const coverUrls = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];

  let coverData: Uint8Array | undefined;
  let coverMime = 'image/jpeg';

  for (const url of coverUrls) {
    try {
      const imgRes = await fetch(url);
      if (imgRes.ok && imgRes.status === 200) {
        const buf = await imgRes.arrayBuffer();
        // YouTube returns a 120x90 transparent/grey image when maxres is unavailable (~1000 bytes)
        if (buf.byteLength > 2000) {
          coverData = new Uint8Array(buf);
          coverMime = imgRes.headers.get('content-type') || 'image/jpeg';
          break;
        }
      }
    } catch (_) {}
  }

  return {
    title,
    description: '',
    author,
    duration: 0,
    coverData,
    coverMime,
    coverFileName: `youtube_${videoId}.jpg`,
  };
}
