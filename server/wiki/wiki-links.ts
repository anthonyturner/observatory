import { posix } from 'node:path';

/** The repository the published files live in, and the branch links name. */
export interface RepoLinks {
  /** e.g. `https://github.com/owner/repo`. */
  readonly repoUrl: string;
  readonly branch: string;
}

/** What a page's links are rewritten against. */
export interface LinkContext extends RepoLinks {
  /** Repository path of the file being rewritten. */
  readonly source: string;
  /** Wiki page name for each published repository path. */
  readonly pageBySource: ReadonlyMap<string, string>;
}

/** A page's full wiki URL: GitHub documents full URLs for wiki links, not bare page names. */
export function wikiPageUrl(repo: RepoLinks, page: string): string {
  return `${repo.repoUrl}/wiki/${page}`;
}

/** Served as the file itself, so the wiki can show it inline; anything else opens on GitHub. */
const RAW_EXTENSIONS: ReadonlySet<string> = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.mp4',
  '.webm',
]);
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
const FENCE = /^\s*(```|~~~)/;
const CODE_SPAN = /(`+[^`]*`+)/;
const INLINE_LINK = /(\]\(\s*<?)([^)\s>]+)/g;
const REFERENCE_LINK = /^(\s*\[[^\]]+\]:\s*<?)([^\s>]+)/;
const HTML_LINK = /(\b(?:src|href)=")([^"]+)/g;

/**
 * The markdown with every relative link, image and HTML `src`/`href` rewritten
 * for the wiki: a published file becomes its wiki page, anything else an
 * absolute GitHub URL. Code blocks and code spans are left as written.
 */
export function rewriteLinks(markdown: string, context: LinkContext): string {
  return rewriteRepoLinks(markdown, context, (page) => wikiPageUrl(context, page));
}

/** As `rewriteLinks`, with a published file's page at `pageUrl(page)` instead of on the wiki. */
export function rewriteRepoLinks(
  markdown: string,
  context: LinkContext,
  pageUrl: (page: string) => string,
): string {
  return rewriteTargets(markdown, (target) => repoTarget(target, context, pageUrl));
}

/** Every link, image and HTML `src`/`href` target in the prose replaced by `resolve`'s answer. */
export function rewriteTargets(markdown: string, resolve: (target: string) => string): string {
  const rewrite = (_: string, lead: string, target: string): string => lead + resolve(target);
  return mapProse(markdown, (prose) => rewriteProse(prose, rewrite));
}

/** Every link, image and HTML `src`/`href` target in the prose, in reading order. */
export function linkTargets(markdown: string): string[] {
  const targets: string[] = [];
  rewriteTargets(markdown, (target) => {
    targets.push(target);
    return target;
  });
  return targets;
}

/** The markdown with `map` applied to its prose; code blocks and code spans are left as written. */
export function mapProse(markdown: string, map: (prose: string) => string): string {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line
        .split(CODE_SPAN)
        .map((part, index) => (index % 2 === 1 ? part : map(part)))
        .join('');
    })
    .join('\n');
}

type Rewrite = (match: string, lead: string, target: string) => string;

function rewriteProse(text: string, rewrite: Rewrite): string {
  return text
    .replace(INLINE_LINK, rewrite)
    .replace(HTML_LINK, rewrite)
    .replace(REFERENCE_LINK, rewrite);
}

/** True for a URL with a scheme, a protocol-relative one, or a same-page anchor. */
export const isAbsolute = (target: string): boolean => ABSOLUTE.test(target);

/** True for a file the browser shows itself, such as an image, rather than a page about it. */
export const isRawFile = (path: string): boolean =>
  RAW_EXTENSIONS.has(posix.extname(path).toLowerCase());

/** Where one link target should point: a published file's page, else the file on GitHub. */
function repoTarget(
  target: string,
  context: LinkContext,
  pageUrl: (page: string) => string,
): string {
  if (isAbsolute(target)) return target;
  const [pathPart, anchor] = splitAnchor(target);
  const path = repoPath(pathPart, context.source);
  if (path === null) return target;
  const page = context.pageBySource.get(path);
  if (page) return pageUrl(page) + anchor;
  return `${context.repoUrl}/${viewOf(pathPart)}/${context.branch}/${path}${anchor}`;
}

/** A link split into its path and its `?query` or `#anchor`, which keeps its mark. */
export function splitAnchor(target: string): readonly [string, string] {
  const at = target.search(/[?#]/);
  return at === -1 ? [target, ''] : [target.slice(0, at), target.slice(at)];
}

/** The repository path a link names, or null when it climbs out of the repository. */
function repoPath(link: string, source: string): string | null {
  const joined = link.startsWith('/') ? link.slice(1) : posix.join(posix.dirname(source), link);
  const path = posix.normalize(joined).replace(/\/$/, '');
  if (path.startsWith('..')) return null;
  return path === '.' ? '' : path;
}

function viewOf(link: string): 'raw' | 'tree' | 'blob' {
  if (isRawFile(link)) return 'raw';
  return link.endsWith('/') ? 'tree' : 'blob';
}
