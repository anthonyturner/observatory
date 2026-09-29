import type { PageFetcher } from '../reader/page-fetch.ts';
import { readablePage } from '../reader/readable.ts';
import { summaryFrom } from './news-summary.ts';

/** Summarises the story at a web address; empty when it cannot. Never throws. */
export type ArticleSummary = (url: string) => Promise<string[]>;

/** A slow site gives up its summary rather than holding up the news. */
const ARTICLE_TIMEOUT_MS = 8_000;
/** Stories stay on Home for days; each is read once, and the oldest forgotten past this. */
const REMEMBERED = 400;

const timeout = (ms: number): Promise<never> =>
  new Promise((_, reject) => setTimeout(() => reject(new Error('too slow')), ms).unref());

/** The opening paragraphs of each story, read once through the reader's fetch, which
 *  refuses addresses on this machine or its network. */
export function articleSummary(fetchPage: PageFetcher): ArticleSummary {
  const remembered = new Map<string, string[]>();
  return async (url) => {
    const known = remembered.get(url);
    if (known) return known;
    let summary: string[] = [];
    try {
      const page = await Promise.race([fetchPage(new URL(url)), timeout(ARTICLE_TIMEOUT_MS)]);
      const read = readablePage(page.html, page.url, page.headers);
      if (!read.isThin) {
        summary = summaryFrom(
          read.blocks.filter((block) => block.kind === 'paragraph').map((block) => block.text),
        );
      }
    } catch {
      // Unreadable (a paywall, a PDF, a refusal): the headline stands alone.
    }
    remembered.set(url, summary);
    if (remembered.size > REMEMBERED) remembered.delete(remembered.keys().next().value!);
    return summary;
  };
}
