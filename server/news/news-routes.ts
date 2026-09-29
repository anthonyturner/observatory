import type { RouteTable } from '../http/api-handler.ts';
import { cached } from '../util/cached.ts';
import { NEWS_SOURCES } from './news-sources.ts';
import { type FeedFetcher, fetchFeed, newsReport } from './news-report.ts';
import type { NewsReport } from './news-types.ts';

export const NEWS_PATH = '/api/news';

/** Feeds post a few times a day; half an hour keeps Home current without asking each visit. */
const NEWS_TTL_MS = 30 * 60_000;

/** The news, read from the public feeds at most every half hour. */
export function cachedNews(fetcher: FeedFetcher = fetchFeed): () => Promise<NewsReport> {
  return cached(() => newsReport(NEWS_SOURCES, fetcher, Date.now()), NEWS_TTL_MS);
}

/** `table` with Home's news. It is public headlines only, so it is the same for everyone. */
export function withNewsRoutes(table: RouteTable, news: () => Promise<NewsReport>): RouteTable {
  return { ...table, get: { ...table.get, [NEWS_PATH]: () => news() } };
}
