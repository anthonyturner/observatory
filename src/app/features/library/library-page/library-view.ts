import { plainOf } from '../../../core/library/doc-inline';
import { parseDoc } from '../../../core/library/doc-markdown';
import { DocBlock, OutlineEntry } from '../../../core/library/doc.types';
import { LibraryPage, LibrarySource } from '../../../core/library/library-report';
import { libraryLink } from '../../../core/library/library-route';
import { PageText, isMatch, snippetOf } from '../../../core/library/library-search';
import { starDiameterOf } from '../../../core/library/page-star';

/** One page in the index: a star sized by its length, and its title. */
export interface IndexEntry {
  readonly slug: string;
  readonly title: string;
  readonly link: string;
  /** The heading it lands on, for an entry that is a part of one page; null for a whole page. */
  readonly fragment: string | null;
  readonly diameter: number;
  readonly isCurrent: boolean;
  /** Where a search found it in the text; null with no search, or a match in the title only. */
  readonly snippet: string | null;
}

/** One shelf of the index, drawn as a constellation. */
export interface IndexShelf {
  readonly name: string;
  readonly entries: readonly IndexEntry[];
}

export interface ArticleView {
  readonly title: string;
  /** Where it came from: the file's path, or the wiki. */
  readonly origin: string;
  readonly url: string;
  readonly blocks: readonly DocBlock[];
  readonly outline: readonly OutlineEntry[];
}

export interface Neighbour {
  readonly title: string;
  readonly link: string;
}

export interface Neighbours {
  readonly previous: Neighbour | null;
  readonly next: Neighbour | null;
}

/** What the index is drawn from. */
export interface IndexInput {
  readonly repo: string;
  readonly pages: readonly LibraryPage[];
  readonly texts: ReadonlyMap<string, PageText>;
  readonly terms: readonly string[];
  readonly currentSlug: string | null;
}

const WIKI_ORIGIN = 'Wiki page';
const MARKDOWN_EXTENSION = '.md';

/** The page a slug names; an empty slug is the first page; null when none has that slug. */
export function currentPage(pages: readonly LibraryPage[], slug: string): LibraryPage | null {
  if (!slug) return pages[0] ?? null;
  return pages.find((page) => page.slug === slug) ?? null;
}

function entryOf(page: LibraryPage, text: PageText | undefined, input: IndexInput): IndexEntry {
  return {
    slug: page.slug,
    title: page.title,
    link: libraryLink(input.repo, page.slug),
    fragment: null,
    diameter: starDiameterOf(text?.wordCount ?? 0),
    isCurrent: page.slug === input.currentSlug,
    snippet: input.terms.length && text ? snippetOf(text.text, input.terms) : null,
  };
}

/** The pages a search leaves, shelf by shelf in reading order; every page with no search. */
export function indexShelves(input: IndexInput): IndexShelf[] {
  const shelves = new Map<string, IndexEntry[]>();
  for (const page of input.pages) {
    const text = input.texts.get(page.slug);
    if (input.terms.length && !(text && isMatch(text, input.terms))) continue;
    const entries = shelves.get(page.shelf) ?? [];
    entries.push(entryOf(page, text, input));
    shelves.set(page.shelf, entries);
  }
  return [...shelves].map(([name, entries]) => ({ name, entries }));
}

const isTitleHeading = (block: DocBlock | undefined, title: string): boolean =>
  block?.kind === 'heading' &&
  block.level === 1 &&
  plainOf(block.spans).trim().toLowerCase() === title.trim().toLowerCase();

/** A page ready to read; a top heading that repeats its title is left to the title. */
export function articleOf(page: LibraryPage, source: LibrarySource): ArticleView {
  const { blocks, outline } = parseDoc(page.markdown);
  return {
    title: page.title,
    origin: source === 'wiki' ? WIKI_ORIGIN : page.slug + MARKDOWN_EXTENSION,
    url: page.url,
    blocks: isTitleHeading(blocks[0], page.title) ? blocks.slice(1) : blocks,
    outline,
  };
}

/** The pages before and after this one in reading order. */
export function neighboursOf(
  pages: readonly LibraryPage[],
  slug: string,
  repo: string,
): Neighbours {
  const at = pages.findIndex((page) => page.slug === slug);
  const near = (index: number): Neighbour | null => {
    const page = at === -1 ? undefined : pages[index];
    return page ? { title: page.title, link: libraryLink(repo, page.slug) } : null;
  };
  return { previous: near(at - 1), next: near(at + 1) };
}
