/** Where a Library's pages came from: the wiki, the README and `docs/` where there is none, or neither. */
export type LibrarySource = 'wiki' | 'docs' | 'none';

/** One page, its links already pointing into the Library wherever they name another page. */
export interface LibraryPage {
  /** The page's part of its Library URL: a wiki page's name, or a file's path without `.md`. */
  readonly slug: string;
  readonly title: string;
  /** The shelf it sits on in the index: the wiki, or the folder it came from. */
  readonly shelf: string;
  /** The page on GitHub. */
  readonly url: string;
  readonly markdown: string;
}

/** What `GET /api/library` returns. */
export interface LibraryReport {
  readonly generatedAt: string;
  readonly repo: string;
  readonly source: LibrarySource;
  /** The wiki, or the repository's files, on GitHub. */
  readonly url: string;
  /** In reading order: the wiki's Home first, or the README. */
  readonly pages: readonly LibraryPage[];
  /** More pages were found than the Library reads. */
  readonly isTruncated: boolean;
}

/** A page's place in the app, `/p/owner/name/library/<slug>`, each part of the slug encoded. */
export const libraryPath = (repo: string, slug: string): string =>
  `/p/${repo}/library/${slug.split('/').map(encodeURIComponent).join('/')}`;
