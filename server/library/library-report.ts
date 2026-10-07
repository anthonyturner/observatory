import type { ActionsReader } from '../github/actions-reader.ts';
import type { DocsReader } from '../github/docs-reader.ts';
import type { WikiReader } from '../github/wiki-reader.ts';
import { mapWithLimit } from '../util/map-with-limit.ts';
import { DOC_PAGE_LIMIT, type DocFile, docPages, docPaths, docsUrl } from './docs-shelf.ts';
import type { LibraryReport } from './library-types.ts';
import { readWiki, wikiPages, wikiUrl } from './wiki-shelf.ts';

/** Everything the Library reads from GitHub. */
export type LibrarySources = WikiReader & DocsReader & Pick<ActionsReader, 'defaultBranch'>;

/** Files read at the same time: locally each is a `gh` process. */
const READ_AT_ONCE = 6;

type Shelf = Omit<LibraryReport, 'generatedAt' | 'repo'>;

async function wikiShelf(github: WikiReader, repo: string): Promise<Shelf | null> {
  const read = await readWiki(github, repo);
  if (!read) return null;
  return {
    source: 'wiki',
    url: wikiUrl(repo),
    pages: wikiPages(repo, read.pages),
    isTruncated: read.isTruncated,
  };
}

async function docsShelf(github: LibrarySources, repo: string): Promise<Shelf> {
  const branch = await github.defaultBranch(repo);
  const allPaths = await github.filePaths(repo, branch);
  const wanted = docPaths(allPaths);
  const paths = wanted.slice(0, DOC_PAGE_LIMIT);
  const texts = await mapWithLimit(paths, READ_AT_ONCE, (path) =>
    github.fileText(repo, path, branch),
  );
  const files = paths.flatMap((path, index): DocFile[] => {
    const markdown = texts[index];
    return markdown === null ? [] : [{ path, markdown }];
  });
  const origin = { repo, branch };
  return {
    source: files.length ? 'docs' : 'none',
    url: docsUrl(origin, allPaths),
    pages: docPages(origin, files),
    isTruncated: wanted.length > paths.length,
  };
}

/** The Library's report: the wiki where the repository has a public one, else its README and docs. */
export async function libraryReport(
  github: LibrarySources,
  repo: string,
  now = Date.now(),
): Promise<LibraryReport> {
  const shelf = (await wikiShelf(github, repo)) ?? (await docsShelf(github, repo));
  return { generatedAt: new Date(now).toISOString(), repo, ...shelf };
}
