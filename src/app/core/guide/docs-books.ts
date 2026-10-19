import { InjectionToken, inject } from '@angular/core';
import { GUIDE_MARKDOWN } from './guide-markdown';
// Bundled as text at build time, like the Guide's, so only the docs page's lazy chunk carries it.
import cheatSheetMarkdown from '../../../../docs/git-cheat-sheet.md' with { loader: 'text' };

/** The headings the docs contents stand under. */
export type DocsGroup = 'Guide' | 'Cheat sheets';

/** A long Markdown text the docs page can show, and how it is named on screen. */
export interface DocsBook {
  /** Its address: `/docs/<slug>`. */
  readonly slug: string;
  readonly group: DocsGroup;
  /** The page's heading, the tab's title and the book's name in the contents. */
  readonly title: string;
  /** The line under the heading. */
  readonly stamp: string;
  /** How a sentence refers to it, such as "the guide", for the filter and the empty result. */
  readonly name: string;
  readonly markdown: string;
}

/**
 * Every book the docs area shows, in contents order. Adding a cheat sheet is
 * its Markdown import above and one entry here: no route, page or component.
 * This file carries the books' text, so only lazy code may import it; links to
 * a book are in `guide-link.ts`, which the rest of the app uses.
 */
export const DOCS_BOOKS = new InjectionToken<readonly DocsBook[]>('DOCS_BOOKS', {
  providedIn: 'root',
  factory: () => [
    {
      slug: 'guide',
      group: 'Guide',
      title: 'Guide',
      stamp: 'How every part of Observatory works',
      name: 'the guide',
      markdown: inject(GUIDE_MARKDOWN),
    },
    {
      slug: 'git-cheat-sheet',
      group: 'Cheat sheets',
      title: 'Git cheat sheet',
      stamp: 'The Git commands you meet most, in plain English',
      name: 'the cheat sheet',
      markdown: cheatSheetMarkdown,
    },
  ],
});
