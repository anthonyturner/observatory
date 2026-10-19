/** The docs area's route, below the site's root; each book answers at `docs/<slug>`. */
export const DOCS_PATH = 'docs';

/** Where a book is read. */
export const docsLink = (slug: string): string => `/${DOCS_PATH}/${slug}`;

/** Where every Guide link goes; a screen adds its section's anchor as the fragment. */
export const GUIDE_LINK = docsLink('guide');
