import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LibraryPage } from './library-page';
import { libraryNote, libraryStamp, stateMessage } from './library-words';

const RULES = [
  '# Rules',
  '',
  'Read [the stack](/p/me/app/library/docs/stack#build) and [GitHub](https://github.com).',
  '',
  '## Never',
  '',
  '<img src=x onerror=alert(1)> stays text.',
  '',
  '## Always',
  '',
  '```ts',
  'const a = 1;',
  '```',
].join('\n');

const REPORT = {
  generatedAt: '2026-10-07T00:00:00Z',
  repo: 'me/app',
  source: 'docs',
  url: 'https://github.com/me/app/tree/main/docs',
  isTruncated: false,
  pages: [
    {
      slug: 'README',
      title: 'App',
      shelf: 'Overview',
      url: 'https://github.com/me/app/blob/main/README.md',
      markdown: '# App\n\nWelcome.',
    },
    {
      slug: 'docs/rules',
      title: 'Rules',
      shelf: 'Docs',
      url: 'https://github.com/me/app/blob/main/docs/rules.md',
      markdown: RULES,
    },
    {
      slug: 'docs/stack',
      title: 'Stack',
      shelf: 'Docs',
      url: 'https://github.com/me/app/blob/main/docs/stack.md',
      markdown: '# Stack\n\n## Build\n\nSquash merge only.',
    },
  ],
};

function render(page: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ owner: 'me', repo: 'app', page })),
          fragment: of(null),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(LibraryPage);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http, element: fixture.nativeElement as HTMLElement };
}

function opened(page: string) {
  const rendered = render(page);
  rendered.http.expectOne('/api/library?repo=me/app').flush(REPORT);
  rendered.fixture.detectChanges();
  return rendered;
}

describe('LibraryPage', () => {
  it('opens the named page beside the index, the Library tab marked as the page', () => {
    const { element } = opened('docs/rules');

    expect(element.querySelector('.hud h1')?.textContent).toBe('Library');
    expect(element.querySelector('.stamp')?.textContent).toBe('me/app · 3 pages');
    expect(
      element.querySelector('app-project-tabs a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/p/me/app/library');
    const current = element.querySelector('app-library-index a[aria-current="page"]');
    expect(current?.textContent).toContain('Rules');
    expect(current?.getAttribute('href')).toBe('/p/me/app/library/docs/rules');
    expect(element.querySelector('app-doc-article h1')?.textContent).toBe('Rules');
  });

  it('draws the page as text, links in the Library and out, and its headings to jump to', () => {
    const { element } = opened('docs/rules');
    const article = element.querySelector('app-doc-article') as HTMLElement;

    const links = [...article.querySelectorAll('app-doc-blocks a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/p/me/app/library/docs/stack#build',
      'https://github.com',
    ]);
    expect(links[1].getAttribute('target')).toBe('_blank');
    expect(article.querySelector('img')).toBeNull();
    expect(article.textContent).toContain('<img src=x onerror=alert(1)> stays text.');
    expect(article.querySelector('#doc-never')?.tagName).toBe('H2');
    expect(article.querySelector('pre code')?.textContent).toBe('const a = 1;');
    const outline = [...article.querySelectorAll('.outline a')];
    expect(outline.map((link) => link.getAttribute('href')?.split('#')[1])).toEqual([
      'never',
      'always',
    ]);
    expect(article.querySelector('.turn .next')?.textContent).toContain('Stack');
  });

  it('opens the first page when none is named', () => {
    const { element } = opened('');

    expect(element.querySelector('app-doc-article h1')?.textContent).toBe('App');
  });

  it('filters the index by title and text', () => {
    const { fixture, element } = opened('');
    const search = element.querySelector('app-library-index input') as HTMLInputElement;

    search.value = 'squash';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const titles = [...element.querySelectorAll('app-library-index .title')];
    expect(titles.map((title) => title.textContent)).toEqual(['Stack']);
    expect(element.querySelector('.snippet')?.textContent).toContain('Squash merge only.');
    expect(element.querySelector('.result')?.textContent).toBe('1 page match.');
  });

  it('walks the index with the arrow keys', () => {
    const { element } = opened('');
    const links = [...element.querySelectorAll<HTMLElement>('app-library-index a[data-page]')];

    links[0].focus();
    links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(links[1]);
    links[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(links[2]);
  });

  it('says so when the page is not in the Library, or the Library cannot be read', () => {
    expect(opened('docs/gone').element.querySelector('.state')?.textContent).toContain(
      'No such page',
    );

    TestBed.resetTestingModule();
    const { fixture, http, element } = render('');
    http
      .expectOne('/api/library?repo=me/app')
      .flush({ error: 'down' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(element.querySelector('.state')?.textContent).toContain('Could not read the library');
  });
});

describe('library words', () => {
  it('says where the pages came from', () => {
    expect(stateMessage({ status: 'missing' })?.headline).toBe('No such project');
    expect(libraryStamp('me/app', null)).toBe('me/app');
    expect(libraryNote(null)).toBeNull();
    expect(
      libraryNote({
        generatedAt: 0,
        repo: 'me/app',
        source: 'wiki',
        url: 'https://github.com/me/app/wiki',
        pages: [],
        isTruncated: true,
      }),
    ).toContain('Only the first pages');
  });
});
