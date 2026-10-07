import { UrlSegment } from '@angular/router';
import { libraryLink, libraryMatcher } from './library-route';

const segments = (path: string): UrlSegment[] =>
  path.split('/').map((part) => new UrlSegment(part, {}));

describe('libraryMatcher', () => {
  it('matches the Library with or without a page, joining a page’s folders', () => {
    const page = libraryMatcher(segments('p/me/app/library/docs/stack/angular'));
    const first = libraryMatcher(segments('p/me/app/library'));

    expect(page?.posParams?.['owner'].path).toBe('me');
    expect(page?.posParams?.['repo'].path).toBe('app');
    expect(page?.posParams?.['page'].path).toBe('docs/stack/angular');
    expect(first?.posParams?.['page'].path).toBe('');
  });

  it('leaves every other project screen alone', () => {
    for (const path of ['p/me/app', 'p/me/app/releases', 'x/me/app/library']) {
      expect(libraryMatcher(segments(path)), path).toBeNull();
    }
  });
});

describe('libraryLink', () => {
  it('builds a page’s address, each part encoded', () => {
    expect(libraryLink('me/app')).toBe('/p/me/app/library');
    expect(libraryLink('me/app', 'docs/a b')).toBe('/p/me/app/library/docs/a%20b');
  });
});
