import { LibraryPage } from '../../../core/library/library-report';
import { pageTextOf, searchTerms } from '../../../core/library/library-search';
import { articleOf, currentPage, indexShelves, neighboursOf } from './library-view';

const page = (slug: string, title: string, shelf: string, markdown = ''): LibraryPage => ({
  slug,
  title,
  shelf,
  url: `https://github.com/me/app/blob/main/${slug}.md`,
  markdown,
});

const PAGES = [
  page('README', 'App', 'Overview', '# App\n\nWelcome aboard.'),
  page(
    'docs/rules',
    'Rules',
    'Docs',
    '# Rules\n\n## Never\n\nSquash merge.\n\n## Always\n\nReview.',
  ),
  page('docs/stack/angular', 'Angular', 'Stack', 'Use OnPush.'),
];
const TEXTS = new Map(PAGES.map((each) => [each.slug, pageTextOf(each)]));

describe('currentPage', () => {
  it('opens the first page with no slug, the named one with one, and none for a stranger', () => {
    expect(currentPage(PAGES, '')?.slug).toBe('README');
    expect(currentPage(PAGES, 'docs/rules')?.title).toBe('Rules');
    expect(currentPage(PAGES, 'docs/gone')).toBeNull();
  });
});

describe('indexShelves', () => {
  const input = { repo: 'me/app', pages: PAGES, texts: TEXTS, currentSlug: 'docs/rules' };

  it('puts every page on its shelf in reading order, the open one marked', () => {
    const shelves = indexShelves({ ...input, terms: [] });

    expect(shelves.map((shelf) => shelf.name)).toEqual(['Overview', 'Docs', 'Stack']);
    const [rules] = shelves[1].entries;
    expect(rules.link).toBe('/p/me/app/library/docs/rules');
    expect(rules.isCurrent).toBe(true);
    expect(rules.snippet).toBeNull();
  });

  it('keeps only the pages a search matches, each with where it matched', () => {
    const shelves = indexShelves({ ...input, terms: searchTerms('squash') });

    expect(shelves.map((shelf) => shelf.name)).toEqual(['Docs']);
    expect(shelves[0].entries[0].snippet).toContain('Squash merge.');
  });
});

describe('articleOf', () => {
  it('leaves a top heading that repeats the title to the title, and says where it came from', () => {
    const article = articleOf(PAGES[1], 'docs');

    expect(article.origin).toBe('docs/rules.md');
    expect(article.blocks[0]).toEqual(expect.objectContaining({ kind: 'heading', level: 2 }));
    expect(article.outline.map((entry) => entry.text)).toEqual(['Never', 'Always']);
    expect(articleOf(PAGES[0], 'wiki').origin).toBe('Wiki page');
  });
});

describe('neighboursOf', () => {
  it('names the pages either side, and none past the ends', () => {
    expect(neighboursOf(PAGES, 'README', 'me/app')).toEqual({
      previous: null,
      next: { title: 'Rules', link: '/p/me/app/library/docs/rules' },
    });
    expect(neighboursOf(PAGES, 'docs/stack/angular', 'me/app').next).toBeNull();
    expect(neighboursOf(PAGES, 'gone', 'me/app')).toEqual({ previous: null, next: null });
  });
});
