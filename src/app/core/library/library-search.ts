import { plainOf } from './doc-inline';
import { parseDoc } from './doc-markdown';
import { DocBlock } from './doc.types';
import { LibraryPage } from './library-report';

/** What search reads of one page: its words, and how many there are. */
export interface PageText {
  readonly slug: string;
  /** The page's words as a reader sees them: no markup, no link addresses. */
  readonly text: string;
  /** Title and text, lower-cased, for matching. */
  readonly haystack: string;
  readonly wordCount: number;
}

/** Characters of context either side of a match in a snippet. */
const SNIPPET_REACH = 70;
const ELLIPSIS = '…';

function blockText(block: DocBlock): string {
  switch (block.kind) {
    case 'heading':
    case 'p':
      return plainOf(block.spans);
    case 'list':
      return block.items
        .map((item) => [plainOf(item.spans), ...item.blocks.map(blockText)].join(' '))
        .join(' ');
    case 'quote':
      return block.blocks.map(blockText).join(' ');
    case 'pre':
      return block.code;
    case 'table':
      return [block.head, ...block.rows].flat().map(plainOf).join(' ');
    case 'rule':
      return '';
  }
}

/** A page's words, read through the same parser that draws it. */
export function pageTextOf(page: LibraryPage): PageText {
  const text = parseDoc(page.markdown).blocks.map(blockText).join(' ').replace(/\s+/g, ' ').trim();
  return {
    slug: page.slug,
    text,
    haystack: `${page.title} ${text}`.toLowerCase(),
    wordCount: text ? text.split(' ').length : 0,
  };
}

/** The words of a search, lower-cased; a page matches only when it holds all of them. */
export const searchTerms = (query: string): string[] =>
  query.toLowerCase().split(/\s+/).filter(Boolean);

export const isMatch = (page: PageText, terms: readonly string[]): boolean =>
  terms.every((term) => page.haystack.includes(term));

/** The text around the first place a term appears, or null when only the title matched. */
export function snippetOf(text: string, terms: readonly string[]): string | null {
  const lower = text.toLowerCase();
  const at = Math.min(...terms.map((term) => lower.indexOf(term)).filter((index) => index !== -1));
  if (!Number.isFinite(at)) return null;
  const start = Math.max(0, at - SNIPPET_REACH);
  const end = Math.min(text.length, at + SNIPPET_REACH);
  const lead = start > 0 ? ELLIPSIS : '';
  const tail = end < text.length ? ELLIPSIS : '';
  return `${lead}${text.slice(start, end).trim()}${tail}`;
}
