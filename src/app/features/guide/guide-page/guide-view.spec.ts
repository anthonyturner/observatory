import { DocsBook } from '../../../core/guide/docs-books';
import { guideOf } from '../../../core/guide/guide';
import { contentsOf, resultLineOf } from './guide-view';

const MARKDOWN = `# Guide

## Project tabs

### Releases

Each release is a star sized by what it shipped.

### Actions

Each workflow is a lane.
`;

const book = (slug: string, group: DocsBook['group'], title: string): DocsBook => ({
  slug,
  group,
  title,
  stamp: '',
  name: `the ${slug}`,
  markdown: MARKDOWN,
});

const GUIDE_BOOK = book('guide', 'Guide', 'Guide');
const FIRST_SHEET = book('first', 'Cheat sheets', 'First cheat sheet');
const SECOND_SHEET = book('second', 'Cheat sheets', 'Second cheat sheet');
const GUIDE = guideOf(MARKDOWN);

const contents = (
  overrides: Partial<Parameters<typeof contentsOf>[0]> = {},
): ReturnType<typeof contentsOf> =>
  contentsOf({
    books: [GUIDE_BOOK, FIRST_SHEET],
    open: GUIDE_BOOK,
    guide: GUIDE,
    terms: [],
    currentId: null,
    ...overrides,
  });

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
      ['Project tabs', 'Cheat sheets'],
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

  it('shows where a search found each section', () => {
    const [shelf] = contents({ terms: ['shipped'] });

    expect(shelf.entries[0].snippet).toContain('sized by what it shipped');
    expect(shelf.entries[1].snippet).toBeNull();
  });
});

describe('resultLineOf', () => {
  it('says nothing with no search', () => {
    expect(resultLineOf(3, [], 'the guide')).toBeNull();
  });

  it('counts the sections found, or says none were', () => {
    expect(resultLineOf(1, ['star'], 'the guide')).toBe('1 section matches.');
    expect(resultLineOf(2, ['star'], 'the guide')).toBe('2 sections match.');
    expect(resultLineOf(0, ['comet'], 'the guide')).toBe('Nothing in the guide matches.');
  });

  it('names the book it searched', () => {
    expect(resultLineOf(0, ['comet'], 'the cheat sheet')).toBe(
      'Nothing in the cheat sheet matches.',
    );
  });
});
