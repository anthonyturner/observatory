import type { DocsBook } from '../../../core/guide/docs-books';
import { Guide, GuideSection } from '../../../core/guide/guide';
import { docsLink } from '../../../core/guide/guide-link';
import { snippetOf } from '../../../core/library/library-search';
import { starDiameterOf } from '../../../core/library/page-star';
import { plural } from '../../../shared/text/plural';
import { IndexEntry, IndexShelf } from '../../library/library-page/library-view';

/** What the contents are drawn from. */
export interface ContentsInput {
  readonly books: readonly DocsBook[];
  /** The book being read: the only one whose parts and sections the contents list. */
  readonly open: DocsBook;
  /** The open book's parts and sections that a search leaves. */
  readonly guide: Guide;
  readonly terms: readonly string[];
  /** The anchor the address names in the open book, lit in the contents; null with none. */
  readonly currentId: string | null;
}

/** A whole book is longer than any section, so its star is the largest. */
const BOOK_STAR = starDiameterOf(10_000);

function sectionEntry(section: GuideSection, book: DocsBook, input: ContentsInput): IndexEntry {
  return {
    slug: section.id,
    title: section.title,
    link: docsLink(book.slug),
    fragment: section.id,
    diameter: starDiameterOf(section.wordCount),
    isCurrent: section.id === input.currentId,
    snippet: input.terms.length ? snippetOf(section.text, input.terms) : null,
  };
}

const bookEntry = (book: DocsBook): IndexEntry => ({
  slug: book.slug,
  title: book.title,
  link: docsLink(book.slug),
  fragment: null,
  diameter: BOOK_STAR,
  isCurrent: false,
  snippet: null,
});

const shelvesOf = (book: DocsBook, input: ContentsInput): IndexShelf[] =>
  book.slug === input.open.slug
    ? input.guide.parts.map((part) => ({
        name: part.title,
        group: book.group,
        entries: part.sections.map((section) => sectionEntry(section, book, input)),
      }))
    : [{ name: null, group: book.group, entries: [bookEntry(book)] }];

/** Runs of headless shelves in one group become a single shelf, so books beside each other share a chart. */
function joinHeadless(shelves: readonly IndexShelf[]): IndexShelf[] {
  const joined: IndexShelf[] = [];
  for (const shelf of shelves) {
    const last = joined.at(-1);
    if (last && last.name === null && shelf.name === null && last.group === shelf.group) {
      joined[joined.length - 1] = { ...last, entries: [...last.entries, ...shelf.entries] };
    } else joined.push(shelf);
  }
  return joined;
}

/** Books gathered by group, the groups in the order they first appear. */
function inGroupOrder(books: readonly DocsBook[]): DocsBook[] {
  return [...new Set(books.map((book) => book.group))].flatMap((group) =>
    books.filter((book) => book.group === group),
  );
}

/**
 * The docs contents as the Library's star chart, under a heading per group.
 * The open book is a constellation per part and a star per section; every
 * other book is one star that opens it.
 */
export const contentsOf = (input: ContentsInput): IndexShelf[] =>
  joinHeadless(inGroupOrder(input.books).flatMap((book) => shelvesOf(book, input)));

/** What a search found, said aloud; null with no search. */
export function resultLineOf(found: number, terms: readonly string[], name: string): string | null {
  if (!terms.length) return null;
  if (!found) return `Nothing in ${name} matches.`;
  return `${plural(found, 'section')} ${found === 1 ? 'matches' : 'match'}.`;
}
