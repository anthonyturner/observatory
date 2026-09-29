import { decodeEntities } from '../reader/readable.ts';
import type { NewsVideo } from './news-types.ts';

// A story's video: YouTube or Vimeo rebuilt from the video's id, or an https file.
// Nothing else is embedded, so a feed cannot put an arbitrary page in Home.

const YOUTUBE_ID = /^[\w-]{11}$/;
const VIMEO_ID = /^\d{5,12}$/;

/** YouTube paths that carry the video's id as their second part. */
const YOUTUBE_ID_PATHS = new Set(['embed', 'shorts', 'live', 'v']);

function youtubeId(host: string, path: readonly string[], url: URL): string | null {
  if (host === 'youtu.be') return path[0] ?? null;
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null;
  if (path[0] === 'watch') return url.searchParams.get('v');
  return YOUTUBE_ID_PATHS.has(path[0]) ? (path[1] ?? null) : null;
}

function vimeoId(host: string, path: readonly string[]): string | null {
  if (host === 'vimeo.com') return path[0] ?? null;
  return host === 'player.vimeo.com' && path[0] === 'video' ? (path[1] ?? null) : null;
}

/** The player for a YouTube or Vimeo address, however it is written; null for any other. */
export function embedOf(value: string | null | undefined): NewsVideo | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(decodeEntities(value.trim()), 'https://video.invalid');
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  const path = url.pathname.split('/').filter(Boolean);
  const youtube = youtubeId(host, path, url);
  if (youtube && YOUTUBE_ID.test(youtube))
    return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${youtube}` };
  const vimeo = vimeoId(host, path);
  if (vimeo && VIMEO_ID.test(vimeo))
    return { kind: 'embed', url: `https://player.vimeo.com/video/${vimeo}` };
  return null;
}

/** An https video file, or null. */
function fileOf(value: string | null | undefined, base?: string): NewsVideo | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value.trim()), base);
    return url.protocol === 'https:' ? { kind: 'file', url: url.href } : null;
  } catch {
    return null;
  }
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1];

const tags = (xml: string, name: string): string[] =>
  xml.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];

const isVideo = (tag: string): boolean =>
  attr(tag, 'medium') === 'video' || /^video\//i.test(attr(tag, 'type') ?? '');

const first = <T>(values: readonly (T | null)[]): T | null =>
  values.find((value): value is T => value !== null) ?? null;

/** The video a feed entry carries: a YouTube or Vimeo story, player or iframe, else a
 *  video file in its media or enclosures. */
export function feedVideo(entry: string, storyUrl: string | null): NewsVideo | null {
  const markup = decodeEntities(entry.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
  return first([
    embedOf(storyUrl),
    ...tags(entry, 'media:player').map((tag) => embedOf(attr(tag, 'url'))),
    ...tags(markup, 'iframe').map((tag) => embedOf(attr(tag, 'src'))),
    ...[...tags(entry, 'media:content'), ...tags(entry, 'enclosure')]
      .filter(isVideo)
      .map((tag) => fileOf(attr(tag, 'url'))),
  ]);
}

/** The video a web page offers for sharing: an Open Graph video or Twitter player,
 *  embedded where it is YouTube or Vimeo, played where it is a video file. */
export function pageVideo(html: string, pageUrl: string): NewsVideo | null {
  const metas = tags(html, 'meta');
  const content = (key: string): string | undefined =>
    attr(
      metas.find((tag) => (attr(tag, 'property') ?? attr(tag, 'name')) === key) ?? '',
      'content',
    );
  const type = content('og:video:type') ?? '';
  const ogVideo = content('og:video:secure_url') ?? content('og:video:url') ?? content('og:video');
  return first([
    embedOf(ogVideo),
    embedOf(content('twitter:player')),
    /^video\//i.test(type) ? fileOf(ogVideo, pageUrl) : null,
  ]);
}
