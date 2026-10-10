import { UrlMatchResult, UrlSegment } from '@angular/router';

const PROJECT = 'p';
const LIBRARY = 'library';

/**
 * `/p/:owner/:repo/library/<page>`, matched below the project's route, where a
 * page from `docs/` keeps its folders as path segments, so its address reads
 * like the file's path. The segments after `library` arrive joined as the
 * `page` parameter.
 */
export function libraryMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  const [library, ...page] = segments;
  if (library?.path !== LIBRARY) return null;
  return {
    consumed: segments,
    posParams: { page: new UrlSegment(page.map((segment) => segment.path).join('/'), {}) },
  };
}

/** A page's address in the app; an empty slug is the Library's first page. */
export function libraryLink(repo: string, slug = ''): string {
  const base = `/${PROJECT}/${repo}/${LIBRARY}`;
  return slug ? `${base}/${slug.split('/').map(encodeURIComponent).join('/')}` : base;
}
