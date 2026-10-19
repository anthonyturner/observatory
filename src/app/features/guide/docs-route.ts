import { Injector, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  PartialMatchRouteSnapshot,
  ResolveFn,
  Router,
  UrlTree,
} from '@angular/router';
import type { DocsBook } from '../../core/guide/docs-books';
import { DOCS_PATH, GUIDE_LINK } from '../../core/guide/guide-link';

/**
 * The docs route's rules. The books are read through a dynamic import, so the
 * router can ask about them without the app's first load carrying their text.
 */

/** The book the address names, or undefined for a slug no book has. */
async function bookAt(
  route: ActivatedRouteSnapshot,
  injector: Injector,
): Promise<DocsBook | undefined> {
  const { DOCS_BOOKS } = await import('../../core/guide/docs-books');
  return injector.get(DOCS_BOOKS).find((book) => book.slug === route.paramMap.get('book'));
}

/** Lets a known book through; an unknown address goes to the Guide. */
export const knownDocsBook: CanActivateFn = async (route) => {
  const injector = inject(Injector);
  const router = inject(Router);
  return (await bookAt(route, injector)) ? true : router.parseUrl(GUIDE_LINK);
};

/** The tab's title: the book's own. */
export const docsBookTitle: ResolveFn<string> = async (route) => {
  const book = await bookAt(route, inject(Injector));
  return `${book?.title ?? 'Docs'} · Observatory`;
};

/**
 * Sends an address from before the docs area to its book, keeping the anchor
 * and the query. A plain `redirectTo` string would drop the anchor.
 */
export const redirectToDocsBook =
  (slug: string) =>
  ({ fragment, queryParams }: PartialMatchRouteSnapshot): UrlTree =>
    inject(Router).createUrlTree([DOCS_PATH, slug], {
      fragment: fragment ?? undefined,
      queryParams,
    });
