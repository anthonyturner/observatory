import type { DocsBook } from '../../../core/guide/docs-books';
import { Guide, GuidePart, GuideSection, sectionCount } from '../../../core/guide/guide';
import { docsLink } from '../../../core/guide/guide-link';
import { snippetOf } from '../../../core/library/library-search';
import { starDiameterOf } from '../../../core/library/page-star';
import { plural } from '../../../shared/text/plural';
import { IndexEntry, IndexShelf } from '../../library/library-page/library-view';

/**
 * A book and what the search leaves of it, read only when asked for, so a
 * book nobody opens or searches is never parsed. Every part of the page that
 * needs a book's matches reads this one value, so they cannot disagree.
 */
export interface Reading {
  readonly book: DocsBook;
  /** The book's parts and sections that hold every search word; all of them with no search. */
  readonly matched: () => Guide;
}

/** What the contents are drawn from. */
export interface ContentsInput {
  readonly readings: readonly Reading[];
  /** The book being read: with no search, the only one whose parts and sections the contents list. */
  readonly open: DocsBook;
  readonly terms: readonly string[];
  /** The anchor the address names in the open book, lit in the contents; null with none. */
  readonly currentId: string | null;
}

/** How many sections a search leaves in the open book, and in all the others together. */
export interface SearchCounts {
  readonly here: number;
  readonly elsewhere: number;
}

/** A whole book is longer than any section, so its star is the largest. */
const BOOK_STAR = starDiameterOf(10_000);
const LABEL_SEPARATOR = ' · ';

const isOpen = (book: DocsBook, input: ContentsInput): boolean => book.slug === input.open.slug;

function sectionEntry(section: GuideSection, book: DocsBook, input: ContentsInput): IndexEntry {
  return {
    slug: section.id,
    title: section.title,
    link: docsLink(book.slug),
    fragment: section.id,
    diameter: starDiameterOf(section.wordCount),
    isCurrent: isOpen(book, input) && section.id === input.currentId,
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

/**
 * A part's shelf name. Where a group holds several books, a bare part name
 * could belong to any of them, so the book's name leads.
 */
const shelfName = (book: DocsBook, part: GuidePart, input: ContentsInput): string =>
  input.readings.filter((reading) => reading.book.group === book.group).length > 1
    ? `${book.title}${LABEL_SEPARATOR}${part.title}`
    : part.title;

/**
 * The book's shelves: each part a constellation of the sections a search
 * leaves. With no search, only the open book is drawn that way; any other
 * book is one star that opens it.
 */
function shelvesOf(reading: Reading, input: ContentsInput): IndexShelf[] {
  const { book } = reading;
  if (!input.terms.length && !isOpen(book, input)) {
    return [{ name: null, group: book.group, entries: [bookEntry(book)] }];
  }
  return reading.matched().parts.map((part) => ({
    name: shelfName(book, part, input),
    group: book.group,
    entries: part.sections.map((section) => sectionEntry(section, book, input)),
  }));
}

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

/** Readings gathered by their book's group, the groups in the order they first appear. */
function inGroupOrder(readings: readonly Reading[]): Reading[] {
  return [...new Set(readings.map(({ book }) => book.group))].flatMap((group) =>
    readings.filter(({ book }) => book.group === group),
  );
}

/**
 * The docs contents as the Library's star chart, under a heading per group.
 * With no search, the open book is a constellation per part and a star per
 * section, and every other book is one star that opens it. A search lists the
 * matching sections of every book, each with where it matched.
 */
export const contentsOf = (input: ContentsInput): IndexShelf[] =>
  joinHeadless(inGroupOrder(input.readings).flatMap((reading) => shelvesOf(reading, input)));

/** How many sections a search leaves in the books other than the open one. */
export function matchesElsewhere(
  readings: readonly Reading[],
  open: DocsBook,
  terms: readonly string[],
): number {
  if (!terms.length) return 0;
  return readings
    .filter(({ book }) => book.slug !== open.slug)
    .reduce((sum, reading) => sum + sectionCount(reading.matched()), 0);
}

const matchVerb = (count: number): string => (count === 1 ? 'matches' : 'match');

/** What a search found, said aloud; null with no search. */
export function resultLineOf(
  { here, elsewhere }: SearchCounts,
  terms: readonly string[],
  name: string,
): string | null {
  if (!terms.length) return null;
  if (!here && !elsewhere) return 'Nothing in the docs matches.';
  if (!here) {
    return `Nothing in ${name} matches; ${plural(elsewhere, 'section')} ${matchVerb(elsewhere)} in the other docs.`;
  }
  const own = `${plural(here, 'section')} ${matchVerb(here)}`;
  return elsewhere ? `${own} in ${name}, and ${elsewhere} more in the other docs.` : `${own}.`;
}

/** The reading column's words when the open book has no match; the contents hold any elsewhere. */
export const emptyLineOf = (name: string, elsewhere: number): string =>
  elsewhere
    ? `Nothing in ${name} matches. The other docs do: the contents list where.`
    : `Nothing in ${name} matches. Try fewer words.`;
