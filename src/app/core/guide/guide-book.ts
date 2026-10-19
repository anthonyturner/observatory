import { InjectionToken, inject } from '@angular/core';
import { GUIDE_LINK } from './guide-link';
import { GUIDE_MARKDOWN } from './guide-markdown';

/**
 * A long Markdown text the Guide page can show: how it is named on screen, the
 * address its contents link to, and the text itself.
 */
export interface GuideBook {
  /** The page's heading, and the name of its article and contents. */
  readonly title: string;
  /** The line under the heading. */
  readonly stamp: string;
  /** How a sentence refers to it, such as "the guide", for the filter and the empty result. */
  readonly name: string;
  /** Its route, so each contents entry links back to this page. */
  readonly link: string;
  readonly markdown: string;
}

/** What the Guide page shows; a route can provide another book to reuse the page. */
export const GUIDE_BOOK = new InjectionToken<GuideBook>('GUIDE_BOOK', {
  providedIn: 'root',
  factory: () => ({
    title: 'Guide',
    stamp: 'How every part of Observatory works',
    name: 'the guide',
    link: GUIDE_LINK,
    markdown: inject(GUIDE_MARKDOWN),
  }),
});
