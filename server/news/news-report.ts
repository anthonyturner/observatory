import type { ArticleSummary } from './article-summary.ts';
import { parseFeed } from './feed-parse.ts';
import { withoutTitle } from './news-summary.ts';
import type { NewsItem, NewsReport, NewsSource, NewsTopic } from './news-types.ts';

/** Reads one feed's XML; throws when it cannot. */
export type FeedFetcher = (url: string) => Promise<string>;

/** Headlines older than this are no longer news. */
const MAX_AGE_MS = 10 * 24 * 60 * 60_000;
/** One busy feed does not fill a section on its own. */
const MAX_PER_SOURCE = 4;
/** What a section shows. */
const SECTION_SIZE = 12;
/** The AI section lists tools first, but keeps room for the rest of the news below them. */
const MAX_TOOLS = 8;

/** A headline about a new or updated tool: a launch, a release, a version, or a kind of tool. */
const TOOL =
  /\b(launch(?:es|ed|ing)?|releas(?:e|es|ed|ing)|introduc(?:es|ed|ing)|now available|generally available|open[- ]sourc(?:es|ed|ing)|ships?|rolls? out|show hn|sdks?|cli|ide|apis?|plugins?|extensions?|mcp|copilot|cursor|claude code|codex|v\d+(?:\.\d+)*|\d+\.\d+(?:\.\d+)?)\b/i;
/** Money and deals: news about companies, not tools, whatever else the headline says. */
const BUSINESS =
  /\$\d|\b(acquir(?:e|es|ed|ing)|acquisition|raises|funding|invest(?:s|ment|ors?)?|seed|series [a-f]|valuation|billion|million|ipo|lawsuit|sues)\b/i;

export const isToolNews = (title: string): boolean => TOOL.test(title) && !BUSINESS.test(title);

const timeOf = (item: NewsItem): number =>
  item.publishedAt ? Date.parse(item.publishedAt) : Number.NEGATIVE_INFINITY;

/** Newest first; undated last. */
const newestFirst = (a: NewsItem, b: NewsItem): number => timeOf(b) - timeOf(a);
/** Tools first, so a feed's few places go to its tools before its other news. */
const toolsFirst = (a: NewsItem, b: NewsItem): number =>
  Number(b.tool) - Number(a.tool) || newestFirst(a, b);

/** The same story from two feeds is the same address, or the same words in its headline. */
const titleKey = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const urlKey = (url: string): string => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

function itemsOf(source: NewsSource, xml: string, now: number): NewsItem[] {
  return parseFeed(xml)
    .filter((each) => !source.only || source.only.test(each.title))
    .filter((each) => !each.publishedAt || now - Date.parse(each.publishedAt) <= MAX_AGE_MS)
    .map((each) => ({
      ...each,
      source: source.name,
      tool: source.topic === 'ai' && isToolNews(each.title),
    }))
    .sort(toolsFirst)
    .slice(0, MAX_PER_SOURCE);
}

/** Feeds on one host are read one after another, so no site gets several requests at once. */
function readAll(
  sources: readonly NewsSource[],
  fetchFeed: FeedFetcher,
): Promise<PromiseSettledResult<string>[]> {
  const lastOnHost = new Map<string, Promise<unknown>>();
  return Promise.allSettled(
    sources.map((source) => {
      const host = new URL(source.url, 'https://feed.invalid').host;
      const read = (lastOnHost.get(host) ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => fetchFeed(source.url));
      lastOnHost.set(host, read);
      return read;
    }),
  );
}

/** `items` newest first, less any story already listed or listed twice. */
function unlisted(items: readonly NewsItem[], listed: Set<string>): NewsItem[] {
  const keysOf = (item: NewsItem): string[] => [urlKey(item.url), titleKey(item.title)];
  const fresh: NewsItem[] = [];
  const here = new Set<string>();
  for (const item of [...items].sort(newestFirst)) {
    const keys = keysOf(item);
    if (keys.some((key) => listed.has(key) || here.has(key))) continue;
    keys.forEach((key) => here.add(key));
    fresh.push(item);
  }
  return fresh;
}

/** Stories read at once for their summaries, so a slow site holds up only its own. */
const SUMMARY_READS_AT_ONCE = 6;

/** `items` with a summary read from each story whose feed gave none. */
async function withSummaries(
  items: readonly NewsItem[],
  summarize: ArticleSummary,
): Promise<NewsItem[]> {
  const done = [...items];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < done.length) {
      const at = next++;
      if (!done[at].summary.length)
        done[at] = {
          ...done[at],
          summary: withoutTitle(await summarize(done[at].url), done[at].title),
        };
    }
  };
  await Promise.all(Array.from({ length: SUMMARY_READS_AT_ONCE }, worker));
  return done;
}

/** The newest headlines from every source. AI is listed first, so a story in both is AI news.
 *  With `summarize`, a story whose feed gave no summary gets its opening paragraphs. */
export async function newsReport(
  sources: readonly NewsSource[],
  fetchFeed: FeedFetcher,
  now: number,
  summarize?: ArticleSummary,
): Promise<NewsReport> {
  const reads = await readAll(sources, fetchFeed);
  const unread = new Set<string>();
  const byTopic: Record<NewsTopic, NewsItem[]> = { ai: [], engineering: [] };
  reads.forEach((read, at) => {
    const source = sources[at];
    if (read.status === 'rejected') unread.add(source.name);
    else byTopic[source.topic].push(...itemsOf(source, read.value, now));
  });

  const listed = new Set<string>();
  const list = (items: NewsItem[]): NewsItem[] => {
    items.forEach((item) =>
      [urlKey(item.url), titleKey(item.title)].forEach((key) => listed.add(key)),
    );
    return items;
  };
  const aiNews = unlisted(byTopic.ai, listed);
  const tools = aiNews.filter((item) => item.tool).slice(0, MAX_TOOLS);
  const rest = aiNews.filter((item) => !item.tool).slice(0, SECTION_SIZE - tools.length);
  const ai = list([...tools, ...rest]);
  const engineering = list(unlisted(byTopic.engineering, listed).slice(0, SECTION_SIZE));
  const [summedAi, summedEngineering] = summarize
    ? await Promise.all([withSummaries(ai, summarize), withSummaries(engineering, summarize)])
    : [ai, engineering];
  return {
    ai: summedAi,
    engineering: summedEngineering,
    unread: [...unread],
    readAt: new Date(now).toISOString(),
  };
}

const FETCH_TIMEOUT_MS = 10_000;
/** OpenAI's feed, the largest, is under a megabyte. */
const MAX_FEED_CHARS = 4 * 1024 * 1024;

/** Reads a feed over the network, once more if the first try fails.
 *  The addresses are this server's own list, never a visitor's. */
export const fetchFeed: FeedFetcher = async (url) => {
  try {
    return await fetchOnce(url);
  } catch {
    return fetchOnce(url);
  }
};

async function fetchOnce(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Observatory-News/1.0',
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const xml = await response.text();
  if (xml.length > MAX_FEED_CHARS) throw new Error(`${url} is larger than a feed should be`);
  return xml;
}
