import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DOCS_BOOKS, DocsBook } from '../../../core/guide/docs-books';
import { GuidePage } from './guide-page';

const MARKDOWN = `# Observatory guide

Welcome to the sky.

## Orrery

### Worlds

Air colour is the most urgent state.

## Project tabs

### Releases

Each release is a star.

### Actions

Each workflow is a lane.
`;

const GUIDE: DocsBook = {
  slug: 'guide',
  group: 'Guide',
  title: 'Guide',
  stamp: 'How every part works',
  name: 'the guide',
  markdown: MARKDOWN,
};

const CHEAT_SHEET: DocsBook = {
  slug: 'git-cheat-sheet',
  group: 'Cheat sheets',
  title: 'Git cheat sheet',
  stamp: 'The Git commands you meet most',
  name: 'the cheat sheet',
  markdown: `# Git cheat sheet

## Get up to date

### Fetch

Download what is new.
`,
};

const NPM_SHEET: DocsBook = {
  slug: 'npm-cheat-sheet',
  group: 'Cheat sheets',
  title: 'npm cheat sheet',
  stamp: 'The npm commands you meet most',
  name: 'the npm sheet',
  markdown: `# npm cheat sheet

## Install

### ci

Install from the lockfile.
`,
};

async function open(url: string, books: readonly DocsBook[] = [GUIDE, CHEAT_SHEET]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'docs/:book', component: GuidePage }]),
      { provide: DOCS_BOOKS, useValue: books },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const go = async (to: string): Promise<void> => {
    await harness.navigateByUrl(to);
    TestBed.tick();
    harness.detectChanges();
  };
  await go(url);
  const element = harness.fixture.nativeElement as HTMLElement;
  const filter = (words: string): void => {
    const box = element.querySelector<HTMLInputElement>('input[type="search"]');
    if (!box) throw new Error('no filter box');
    box.value = words;
    box.dispatchEvent(new Event('input'));
    harness.detectChanges();
  };
  return { element, filter, go };
}

const headings = (element: HTMLElement): (string | undefined)[] =>
  Array.from(element.querySelectorAll('article h2, article h3')).map((h) => h.textContent?.trim());

const links = (element: HTMLElement): HTMLAnchorElement[] =>
  Array.from(element.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Contents"] a'));

describe('GuidePage', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows the intro, then every part and section, each with its anchor', async () => {
    const { element } = await open('/docs/guide');

    expect(element.querySelector('article p')?.textContent).toContain('Welcome to the sky.');
    expect(headings(element)).toEqual(['Orrery', 'Worlds', 'Project tabs', 'Releases', 'Actions']);
    expect(element.querySelector('#doc-releases')?.tagName).toBe('H3');
  });

  it('titles the page with the book the address names', async () => {
    const { element } = await open('/docs/git-cheat-sheet');

    expect(element.querySelector('h1')?.textContent).toBe('Git cheat sheet');
    expect(element.querySelector('.stamp')?.textContent).toBe('The Git commands you meet most');
    expect(element.querySelector('article')?.getAttribute('aria-label')).toBe('Git cheat sheet');
    expect(headings(element)).toEqual(['Get up to date', 'Fetch']);
  });

  it('draws a Guide group and a Cheat sheets group, the open book in full and the others as one entry', async () => {
    const { element } = await open('/docs/guide');

    const groups = Array.from(element.querySelectorAll('nav h2.group')).map((h) => h.textContent);
    expect(groups).toEqual(['Guide', 'Cheat sheets']);
    expect(links(element).map((link) => link.getAttribute('href'))).toEqual([
      '/docs/guide#worlds',
      '/docs/guide#releases',
      '/docs/guide#actions',
      '/docs/git-cheat-sheet',
    ]);
    expect(
      Array.from(element.querySelectorAll('nav h3.shelf-name')).map((h) => h.textContent),
    ).toEqual(['Orrery', 'Project tabs']);
  });

  it('lights only the entry the address names, by book and anchor', async () => {
    const { element } = await open('/docs/guide#releases');

    const lit = links(element).filter((link) => link.hasAttribute('aria-current'));
    expect(lit.map((link) => link.getAttribute('href'))).toEqual(['/docs/guide#releases']);
  });

  it('finds a book added to the registry under Cheat sheets', async () => {
    const { element } = await open('/docs/guide', [GUIDE, CHEAT_SHEET, NPM_SHEET]);

    const hrefs = links(element).map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/docs/npm-cheat-sheet');
    const sheets = Array.from(element.querySelectorAll('nav section')).at(-1);
    expect(sheets?.textContent).toContain('npm cheat sheet');
    expect(sheets?.previousElementSibling?.textContent).toBe('Cheat sheets');
  });

  it('opens another book in the same page when only the book changes', async () => {
    const { element, go } = await open('/docs/guide');
    const page = element.querySelector('app-guide-page') ?? element;

    await go('/docs/git-cheat-sheet#fetch');

    expect(element.querySelector('app-guide-page') ?? element).toBe(page);
    expect(element.querySelector('h1')?.textContent).toBe('Git cheat sheet');
    expect(links(element).map((link) => link.getAttribute('href'))).toEqual([
      '/docs/guide',
      '/docs/git-cheat-sheet#fetch',
    ]);
  });

  it('brings the section a link names into view and gives its heading the focus', async () => {
    const { element } = await open('/docs/guide#actions');

    const heading = element.querySelector<HTMLElement>('#doc-actions');
    expect(heading?.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(heading);
  });

  it('starts a book just opened at its top when the address names no section', async () => {
    const { element, go } = await open('/docs/guide#actions');
    const reading = element.querySelector<HTMLElement>('main.reading');
    if (!reading) throw new Error('no reading column');
    reading.scrollTop = 400;

    await go('/docs/git-cheat-sheet');

    expect(reading.scrollTop).toBe(0);
    expect(document.activeElement).toBe(reading);
  });

  it('narrows the text and the contents to the sections a filter finds', async () => {
    const { element, filter } = await open('/docs/guide');

    filter('workflow');

    expect(headings(element)).toEqual(['Project tabs', 'Actions']);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('1 section matches.');
  });

  it('filters only the open book, naming it when nothing matches', async () => {
    const { element, filter } = await open('/docs/git-cheat-sheet');

    filter('nebula');

    expect(element.querySelector('label')?.textContent).toBe('Filter the cheat sheet');
    expect(element.querySelector('.empty')?.textContent).toContain(
      'Nothing in the cheat sheet matches.',
    );
  });

  it('says so when nothing matches', async () => {
    const { element, filter } = await open('/docs/guide');

    filter('nebula');

    expect(headings(element)).toEqual([]);
    expect(element.querySelector('.empty')?.textContent).toContain('Nothing in the guide matches.');
  });
});
