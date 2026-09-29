import { decodeEntities } from '../reader/readable.ts';
import { feedImage } from './news-image.ts';
import type { FeedItem } from './news-types.ts';
import { feedSummary, withoutTitle } from './news-summary.ts';

// RSS 2.0 and Atom both, read with patterns rather than an XML parser: a
// headline, its link, its date, a summary and a picture are all Home needs.

const blocks = (xml: string, tag: string): string[] =>
  xml.match(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi')) ?? [];

/** The raw inside of the first `<tag>` in `xml`, markup and all. */
const raw = (xml: string, tag: string): string | null =>
  new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml)?.[1] ?? null;

/** The text of the first `<tag>` in `xml`, CDATA unwrapped and markup dropped. */
function text(xml: string, tag: string): string | null {
  const inner = raw(xml, tag);
  if (inner === null) return null;
  const unwrapped = inner.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Twice: a feed may escape its markup, which decodes into tags to drop.
  const plain = decodeEntities(decodeEntities(unwrapped).replace(/<[^>]+>/g, ''))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain || null;
}

/** The first of `tags` that gives a summary: a feed's short description before its full content. */
function summaryOf(entry: string, tags: readonly string[]): string[] {
  for (const tag of tags) {
    const summary = feedSummary(raw(entry, tag));
    if (summary.length) return summary;
  }
  return [];
}

/** An Atom entry's page: its `alternate` link, or its first link with no `rel`. */
function atomLink(entry: string): string | null {
  const links = entry.match(/<link\b[^>]*>/gi) ?? [];
  const rel = (link: string): string | undefined => /\brel\s*=\s*["']([^"']+)["']/i.exec(link)?.[1];
  const chosen =
    links.find((link) => rel(link) === 'alternate') ?? links.find((link) => !rel(link));
  const href = chosen && /\bhref\s*=\s*["']([^"']+)["']/i.exec(chosen)?.[1];
  return href ? decodeEntities(href) : null;
}

/** A web address, or null for anything else (a feed's `javascript:` link, a bare id). */
function webUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function isoTime(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function item(
  title: string | null,
  url: string | null,
  when: string | null,
  summary: string[],
  image: string | null,
): FeedItem | null {
  const link = webUrl(url);
  return title && link
    ? { title, url: link, publishedAt: isoTime(when), summary: withoutTitle(summary, title), image }
    : null;
}

/** Every headline in an RSS or Atom feed that has a title and a web link, in feed order,
 *  with its summary and picture where the feed gives them. */
export function parseFeed(xml: string): FeedItem[] {
  const rss = blocks(xml, 'item').map((entry) =>
    item(
      text(entry, 'title'),
      text(entry, 'link') ?? text(entry, 'guid'),
      text(entry, 'pubDate') ?? text(entry, 'dc:date'),
      summaryOf(entry, ['description', 'content:encoded']),
      feedImage(entry),
    ),
  );
  const atom = blocks(xml, 'entry').map((entry) =>
    item(
      text(entry, 'title'),
      atomLink(entry),
      text(entry, 'published') ?? text(entry, 'updated'),
      summaryOf(entry, ['summary', 'content']),
      feedImage(entry),
    ),
  );
  return [...rss, ...atom].filter((each): each is FeedItem => each !== null);
}
