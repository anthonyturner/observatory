import { DocsBook } from '../../../core/guide/docs-books';
import { guideMatching, guideOf } from '../../../core/guide/guide';
import { searchTerms } from '../../../core/library/library-search';
import { Reading, contentsOf, emptyLineOf, matchesElsewhere, resultLineOf } from './guide-view';

const MARKDOWN = `# Guide

## Project tabs

### Releases

Each release is a star sized by what it shipped.

### Actions

Each workflow is a lane.
`;

const SHEET_MARKDOWN = `# Sheet

## Get up to date

### Fetch

Download what is new. A workflow may run it for you.

### Pull

Fetch, then merge.
`;

const book = (
  slug: string,
  group: DocsBook['group'],
  title: string,
  markdown = MARKDOWN,
): DocsBook => ({
  slug,
  group,
  title,
  stamp: '',
  name: `the ${slug}`,
  markdown,
});

const GUIDE_BOOK = book('guide', 'Guide', 'Guide');
const FIRST_SHEET = book('first', 'Cheat sheets', 'First cheat sheet', SHEET_MARKDOWN);
const SECOND_SHEET = book('second', 'Cheat sheets', 'Second cheat sheet');

const reading = (of: DocsBook, terms: readonly string[] = []): Reading => ({
  book: of,
  matched: () => guideMatching(guideOf(of.markdown), terms),
});

interface Setup {
  readonly books?: readonly DocsBook[];
  readonly open?: DocsBook;
  readonly terms?: readonly string[];
  readonly currentId?: string | null;
}

const contents = ({
  books = [GUIDE_BOOK, FIRST_SHEET],
  open = GUIDE_BOOK,
  terms = [],
  currentId = null,
}: Setup = {}): ReturnType<typeof contentsOf> =>
  contentsOf({ readings: books.map((of) => reading(of, terms)), open, terms, currentId });

describe('contentsOf', () => {
  it('draws each part of the open book as a shelf and each section as a star linking to its anchor', () => {
    const [shelf] = contents();

    expect(shelf.name).toBe('Project tabs');
    expect(shelf.group).toBe('Guide');
    expect(shelf.entries.map(({ title, link, fragment }) => [title, link, fragment])).toEqual([
      ['Releases', '/docs/guide', 'releases'],
      ['Actions', '/docs/guide', 'actions'],
    ]);
  });

  it('draws every other book as one star that opens it, under its own group', () => {
    const shelves = contents();

    expect(shelves).toHaveLength(2);
    expect(shelves[1]).toMatchObject({ name: null, group: 'Cheat sheets' });
    expect(shelves[1].entries.map(({ title, link, fragment }) => [title, link, fragment])).toEqual([
      ['First cheat sheet', '/docs/first', null],
    ]);
  });

  it('opens a cheat sheet in full and folds the Guide to one star', () => {
    const shelves = contents({ open: FIRST_SHEET });

    expect(shelves.map(({ name, group }) => [name, group])).toEqual([
      [null, 'Guide'],
      ['Get up to date', 'Cheat sheets'],
    ]);
    expect(shelves[0].entries[0].link).toBe('/docs/guide');
    expect(shelves[1].entries[0].link).toBe('/docs/first');
  });

  it('keeps each group together, in the order the registry first names them, with its other books in one shelf', () => {
    const shelves = contents({
      books: [FIRST_SHEET, GUIDE_BOOK, SECOND_SHEET],
      open: GUIDE_BOOK,
    });

    expect(shelves.map(({ name, group }) => [name, group])).toEqual([
      [null, 'Cheat sheets'],
      ['Project tabs', 'Guide'],
    ]);
    expect(shelves[0].entries.map((entry) => entry.title)).toEqual([
      'First cheat sheet',
      'Second cheat sheet',
    ]);
  });

  it('lights only the section the address names in the open book', () => {
    const shelves = contents({ currentId: 'actions' });

    expect(shelves.flatMap((shelf) => shelf.entries).map((entry) => entry.isCurrent)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('names the book on each part where a group holds several, so two sheets stay apart', () => {
    const shelves = contents({
      books: [GUIDE_BOOK, FIRST_SHEET, SECOND_SHEET],
      open: FIRST_SHEET,
    });

    expect(shelves.map(({ name }) => name)).toEqual([
      null,
      'First cheat sheet · Get up to date',
      null,
    ]);
  });

  describe('with a search', () => {
    const search = (words: string, overrides: Setup = {}): ReturnType<typeof contentsOf> =>
      contents({ terms: searchTerms(words), ...overrides });

    it('lists the matching sections of every book, each with where it matched', () => {
      const shelves = search('workflow');

      expect(
        shelves.map(({ name, group, entries }) => [
          name,
          group,
          entries.map((entry) => `${entry.link}#${entry.fragment}`),
        ]),
      ).toEqual([
        ['Project tabs', 'Guide', ['/docs/guide#actions']],
        ['Get up to date', 'Cheat sheets', ['/docs/first#fetch']],
      ]);
      expect(shelves[0].entries[0].snippet).toContain('Each workflow is a lane');
      expect(shelves[1].entries[0].snippet).toContain('A workflow may run it for you');
    });

    it('lists matches in other books even when the open book has none', () => {
      const shelves = search('merge');

      expect(shelves.map((shelf) => shelf.group)).toEqual(['Cheat sheets']);
      expect(shelves[0].entries.map((entry) => entry.title)).toEqual(['Pull']);
    });

    it('names the book on each part where a group holds several, matching or not', () => {
      const shelves = search('lane', {
        books: [GUIDE_BOOK, FIRST_SHEET, SECOND_SHEET],
      });

      expect(shelves.map(({ name }) => name)).toEqual([
        'Project tabs',
        'Second cheat sheet · Project tabs',
      ]);
    });

    it('lights a section only in the open book, not the same anchor in another', () => {
      const shelves = search('workflow', { open: FIRST_SHEET, currentId: 'fetch' });

      expect(shelves.flatMap((shelf) => shelf.entries).map((entry) => entry.isCurrent)).toEqual([
        false,
        true,
      ]);
    });

    it('draws nothing when no book matches', () => {
      expect(search('nebula')).toEqual([]);
    });

    it('reads no book that is not open until a search asks', () => {
      const matchedSheet = vi.fn(() => guideOf(MARKDOWN));
      const lazy = (terms: readonly string[]): Reading[] => [
        reading(GUIDE_BOOK, terms),
        { book: FIRST_SHEET, matched: matchedSheet },
      ];

      contentsOf({ readings: lazy([]), open: GUIDE_BOOK, terms: [], currentId: null });
      expect(matchedSheet).not.toHaveBeenCalled();

      contentsOf({ readings: lazy(['lane']), open: GUIDE_BOOK, terms: ['lane'], currentId: null });
      expect(matchedSheet).toHaveBeenCalled();
    });
  });
});

describe('matchesElsewhere', () => {
  const readings = (terms: readonly string[]): Reading[] =>
    [GUIDE_BOOK, FIRST_SHEET].map((of) => reading(of, terms));

  it('counts the sections a search leaves in every book but the open one', () => {
    expect(matchesElsewhere(readings(['fetch']), GUIDE_BOOK, ['fetch'])).toBe(2);
    expect(matchesElsewhere(readings(['workflow']), FIRST_SHEET, ['workflow'])).toBe(1);
  });

  it('counts none with no search', () => {
    expect(matchesElsewhere(readings([]), GUIDE_BOOK, [])).toBe(0);
  });
});

describe('resultLineOf', () => {
  const counts = (here: number, elsewhere: number) => ({ here, elsewhere });

  it('says nothing with no search', () => {
    expect(resultLineOf(counts(3, 1), [], 'the guide')).toBeNull();
  });

  it('counts the sections found in the open book, or says none were', () => {
    expect(resultLineOf(counts(1, 0), ['star'], 'the guide')).toBe('1 section matches.');
    expect(resultLineOf(counts(2, 0), ['star'], 'the guide')).toBe('2 sections match.');
    expect(resultLineOf(counts(0, 0), ['comet'], 'the guide')).toBe('Nothing in the docs matches.');
  });

  it('adds the matches in the other docs', () => {
    expect(resultLineOf(counts(2, 3), ['star'], 'the guide')).toBe(
      '2 sections match in the guide, and 3 more in the other docs.',
    );
  });

  it('names the open book, and counts the other docs, when only they match', () => {
    expect(resultLineOf(counts(0, 1), ['fetch'], 'the guide')).toBe(
      'Nothing in the guide matches; 1 section matches in the other docs.',
    );
    expect(resultLineOf(counts(0, 4), ['fetch'], 'the cheat sheet')).toBe(
      'Nothing in the cheat sheet matches; 4 sections match in the other docs.',
    );
  });
});

describe('emptyLineOf', () => {
  it('names the book, and points at the contents when the other docs match', () => {
    expect(emptyLineOf('the guide', 0)).toBe('Nothing in the guide matches. Try fewer words.');
    expect(emptyLineOf('the guide', 2)).toBe(
      'Nothing in the guide matches. The other docs do: the contents list where.',
    );
  });
});
