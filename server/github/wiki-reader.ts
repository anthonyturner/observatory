/** What the Library reads of a repository's wiki, and nothing else. */
export interface WikiReader {
  /** One wiki page's markdown, or null when the wiki has no such page or GitHub will not serve it. */
  wikiPage(repo: string, page: string): Promise<string | null>;
}

/**
 * GitHub has no API for wiki content, but serves a public wiki's files raw
 * here, with no token. A private wiki answers 404, the same as a missing page.
 */
const WIKI_RAW_ROOT = 'https://raw.githubusercontent.com/wiki';
const NOT_FOUND = 404;
const PAGE_EXTENSION = '.md';

/** A file in `repo`'s wiki, by its path there, served as itself. */
export const wikiRawUrl = (repo: string, path: string): string =>
  `${WIKI_RAW_ROOT}/${repo}/${path.split('/').map(encodeURIComponent).join('/')}`;

/** A wiki read over plain HTTPS: no `git`, no token, so the same locally and hosted. */
export function rawWikiReader(send: typeof fetch = fetch): WikiReader {
  return {
    wikiPage: async (repo, page) => {
      const response = await send(wikiRawUrl(repo, page + PAGE_EXTENSION));
      if (response.status === NOT_FOUND) return null;
      if (!response.ok) throw new Error(`GitHub wiki: HTTP ${response.status} for ${repo} ${page}`);
      return response.text();
    },
  };
}
