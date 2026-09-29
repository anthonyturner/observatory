import type { PageFetcher } from '../reader/page-fetch.ts';
import { readablePage } from '../reader/readable.ts';
import { pageImage } from './news-image.ts';
import { summaryFrom } from './news-summary.ts';

/** What a story's own page gives Home where its feed did not. */
export interface ArticleDetails {
  /** Its opening paragraphs; empty where none could be read. */
  readonly summary: string[];
  /** Its sharing picture, https only; null where it has none. */
  readonly image: string | null;
}

/** Reads the story at a web address; empty details when it cannot. Never throws. */
export type ArticleReader = (url: string) => Promise<ArticleDetails>;

/** A slow site gives up its details rather than holding up the news. */
const ARTICLE_TIMEOUT_MS = 8_000;
/** Stories stay on Home for days; each is read once, and the oldest forgotten past this. */
const REMEMBERED = 400;

const timeout = (ms: number): Promise<never> =>
  new Promise((_, reject) => setTimeout(() => reject(new Error('too slow')), ms).unref());

/** The opening paragraphs and sharing picture of each story, read once through the
 *  reader's fetch, which refuses addresses on this machine or its network. */
export function articleReader(fetchPage: PageFetcher): ArticleReader {
  const remembered = new Map<string, ArticleDetails>();
  return async (url) => {
    const known = remembered.get(url);
    if (known) return known;
    let details: ArticleDetails = { summary: [], image: null };
    try {
      const page = await Promise.race([fetchPage(new URL(url)), timeout(ARTICLE_TIMEOUT_MS)]);
      const read = readablePage(page.html, page.url, page.headers);
      const paragraphs = read.blocks
        .filter((block) => block.kind === 'paragraph')
        .map((block) => block.text);
      details = {
        summary: read.isThin ? [] : summaryFrom(paragraphs),
        image: pageImage(page.html, page.url),
      };
    } catch {
      // Unreadable (a paywall, a PDF, a refusal): the headline stands alone.
    }
    remembered.set(url, details);
    if (remembered.size > REMEMBERED) remembered.delete(remembered.keys().next().value!);
    return details;
  };
}
