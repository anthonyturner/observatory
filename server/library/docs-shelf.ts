import { posix } from 'node:path';
import { rewriteRepoLinks } from '../wiki/wiki-links.ts';
import { firstHeading } from '../wiki/wiki-pages.ts';
import { type LibraryPage, libraryPath } from './library-types.ts';

/** The most files a docs Library reads; each costs a request. */
export const DOC_PAGE_LIMIT = 100;

const DOCS_FOLDER = 'docs';
const README = /^readme\.md$/i;
const MARKDOWN = /\.md$/i;
/** A folder's own page, read before the rest of it. */
const INDEX_NAMES: ReadonlySet<string> = new Set(['readme.md', 'index.md']);
const ROOT_SHELF = 'Overview';
const DOCS_SHELF = 'Docs';

/** One file read from the repository. */
export interface DocFile {
  readonly path: string;
  readonly markdown: string;
}

/** The repository the files came from, and the branch they were read on. */
export interface DocsOrigin {
  /** `owner/name`. */
  readonly repo: string;
  readonly branch: string;
}

const indexRank = (path: string): number =>
  INDEX_NAMES.has(posix.basename(path).toLowerCase()) ? 0 : 1;

function byFolderThenIndex(a: string, b: string): number {
  const [folderA, folderB] = [posix.dirname(a), posix.dirname(b)];
  if (folderA !== folderB) return folderA.localeCompare(folderB);
  return indexRank(a) - indexRank(b) || a.localeCompare(b);
}

/** The files a docs Library reads, in reading order: the README, then `docs/`, each folder's index first. */
export function docPaths(paths: readonly string[]): string[] {
  const docs = paths
    .filter((path) => path.startsWith(`${DOCS_FOLDER}/`) && MARKDOWN.test(path))
    .toSorted(byFolderThenIndex);
  return [...paths.filter((path) => README.test(path)), ...docs];
}

/** `agent-workflows` as `Agent workflows`. */
export function humanized(name: string): string {
  const words = name.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The shelf a file sits on: the repository's root, `docs/` itself, or a folder inside it. */
export function shelfOf(path: string): string {
  const folder = posix.dirname(path);
  if (folder === '.') return ROOT_SHELF;
  if (folder === DOCS_FOLDER) return DOCS_SHELF;
  return folder.split('/').slice(1).map(humanized).join(' / ');
}

const slugOf = (path: string): string => path.replace(MARKDOWN, '');

/** Each file as a page, its links to the other files pointing at their pages in the Library. */
export function docPages(origin: DocsOrigin, files: readonly DocFile[]): LibraryPage[] {
  const { repo, branch } = origin;
  const repoUrl = `https://github.com/${repo}`;
  const pageBySource = new Map(files.map(({ path }) => [path, slugOf(path)]));
  const pageUrl = (slug: string): string => libraryPath(repo, slug);
  return files.map(({ path, markdown }) => ({
    slug: slugOf(path),
    title: firstHeading(markdown) ?? humanized(slugOf(posix.basename(path))),
    shelf: shelfOf(path),
    url: `${repoUrl}/blob/${branch}/${path}`,
    markdown: rewriteRepoLinks(
      markdown.replace(/\r\n/g, '\n'),
      { repoUrl, branch, source: path, pageBySource },
      pageUrl,
    ),
  }));
}

/** The docs folder on GitHub where there is one, else the repository. */
export function docsUrl(origin: DocsOrigin, paths: readonly string[]): string {
  const repoUrl = `https://github.com/${origin.repo}`;
  const hasDocs = paths.some((path) => path.startsWith(`${DOCS_FOLDER}/`));
  return hasDocs ? `${repoUrl}/tree/${origin.branch}/${DOCS_FOLDER}` : repoUrl;
}
