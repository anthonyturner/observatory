import { type WikiReader, wikiRawUrl } from '../github/wiki-reader.ts';
import {
  isAbsolute,
  isRawFile,
  linkTargets,
  mapProse,
  rewriteTargets,
  splitAnchor,
} from '../wiki/wiki-links.ts';
import { type LibraryPage, libraryPath } from './library-types.ts';

/** The most wiki pages the Library reads; each costs a request. */
export const WIKI_PAGE_LIMIT = 80;

/** The page every wiki opens on, and the one it is created with. */
const HOME = 'Home';
const SIDEBAR = '_Sidebar';
const WIKI_SHELF = 'Wiki';
/** Pages read at the same time while following links. */
const READ_AT_ONCE = 8;
/** `[[Page]]` and `[[Text|Page]]`, the wiki's own link syntax. */
const WIKI_LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** The pages found by following links from Home and the sidebar, Home first. */
export interface WikiRead {
  /** Page name to markdown, in the order they were found. */
  readonly pages: ReadonlyMap<string, string>;
  /** Links to pages not read were left, past WIKI_PAGE_LIMIT. */
  readonly isTruncated: boolean;
}

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The wiki on GitHub. */
export const wikiUrl = (repo: string): string => `https://github.com/${repo}/wiki`;

/** `https://github.com/owner/name/wiki/Page`, or the same from the site's root. */
const wikiUrlPattern = (repo: string): RegExp =>
  new RegExp(`^(?:https?://github\\.com)?/${escaped(repo)}/wiki(?:/([^?#]*))?$`, 'i');

/** `[[Text|Page]]` as `[Text](Page)`, so the rest of the reader sees ordinary links. */
export const withMarkdownLinks = (markdown: string): string =>
  mapProse(markdown, (prose) =>
    prose.replace(WIKI_LINK, (_, first: string, second: string | undefined) => {
      const page = (second ?? first).trim().replace(/\s+/g, '-');
      return `[${first.trim()}](${page})`;
    }),
  );

/** A link's path as a page name, or null when it is not one: a folder, or a special page. */
function pageNameOf(path: string): string | null {
  let name: string;
  try {
    name = decodeURIComponent(path);
  } catch {
    return null;
  }
  name = name
    .replace(/^\.?\//, '')
    .replace(/\.md$/i, '')
    .trim()
    .replace(/\s+/g, '-');
  return name && !name.includes('/') && !/^[._]/.test(name) ? name : null;
}

/** The wiki page a link names, by its page name or its full wiki URL, or null. */
export function namedPage(target: string, repo: string): string | null {
  const [path] = splitAnchor(target);
  const wikiLink = wikiUrlPattern(repo).exec(path);
  if (wikiLink) return pageNameOf(wikiLink[1] || HOME);
  if (isAbsolute(target) || !path || isRawFile(path)) return null;
  return pageNameOf(path);
}

/** Each page a page links to, once, in reading order. */
export const pagesLinkedFrom = (markdown: string, repo: string): string[] => [
  ...new Set(
    linkTargets(withMarkdownLinks(markdown))
      .map((target) => namedPage(target, repo))
      .filter((name) => name !== null),
  ),
];

/**
 * A wiki has no list of its pages GitHub will serve, so the reader follows
 * links from Home and the sidebar. A page nothing links to is not found.
 */
export async function readWiki(reader: WikiReader, repo: string): Promise<WikiRead | null> {
  const [home, sidebar] = await Promise.all([
    reader.wikiPage(repo, HOME),
    reader.wikiPage(repo, SIDEBAR),
  ]);
  if (home === null) return null;
  const pages = new Map([[HOME, home]]);
  const seen = new Set([HOME, SIDEBAR]);
  const queue: string[] = [];
  const follow = (markdown: string): void => {
    const unseen = pagesLinkedFrom(markdown, repo).filter((name) => !seen.has(name));
    unseen.forEach((name) => seen.add(name));
    queue.push(...unseen);
  };
  follow(sidebar ?? '');
  follow(home);
  while (queue.length && pages.size < WIKI_PAGE_LIMIT) {
    const batch = queue.splice(0, Math.min(READ_AT_ONCE, WIKI_PAGE_LIMIT - pages.size));
    const texts = await Promise.all(batch.map((name) => reader.wikiPage(repo, name)));
    batch.forEach((name, index) => {
      const text = texts[index];
      if (text === null) return;
      pages.set(name, text);
      follow(text);
    });
  }
  return { pages, isTruncated: queue.length > 0 };
}

/** Where a link on a wiki page points: a page read into the Library, else GitHub. */
function libraryTarget(target: string, repo: string, known: ReadonlySet<string>): string {
  const [path, anchor] = splitAnchor(target);
  const name = namedPage(target, repo);
  if (name !== null && known.has(name)) return libraryPath(repo, name) + anchor;
  if (isAbsolute(target)) return target;
  if (name !== null) return `${wikiUrl(repo)}/${encodeURIComponent(name)}${anchor}`;
  return isRawFile(path) ? wikiRawUrl(repo, path.replace(/^\.?\//, '')) : target;
}

/** The pages read, as the Library shows them, titled as GitHub titles a wiki page. */
export function wikiPages(repo: string, pages: ReadonlyMap<string, string>): LibraryPage[] {
  const known = new Set(pages.keys());
  return [...pages].map(([name, markdown]) => ({
    slug: name,
    title: name.replace(/-/g, ' '),
    shelf: WIKI_SHELF,
    url: `${wikiUrl(repo)}/${encodeURIComponent(name)}`,
    markdown: rewriteTargets(withMarkdownLinks(markdown.replace(/\r\n/g, '\n')), (target) =>
      libraryTarget(target, repo, known),
    ),
  }));
}
