import { rewriteLinks, type LinkContext, type RepoLinks } from './wiki-links.ts';
import type { WikiPage } from './wiki-pages.ts';

/** The first line of every page the sync writes: how it tells its own pages from hand-written ones. */
const MARKER = '<!-- docs-wiki-sync';
export const SIDEBAR_NAME = '_Sidebar';

/** True when the sync wrote this page, so it may replace or remove it. */
export function isGenerated(content: string): boolean {
  return content.startsWith(MARKER);
}

/** One page's wiki markdown: the marker, a banner naming its source, then the rewritten text. */
export function renderPage(page: WikiPage, markdown: string, links: LinkContext): string {
  const sourceUrl = `${links.repoUrl}/blob/${links.branch}/${page.source}`;
  return [
    `${MARKER}: generated from ${page.source}; edit it there -->`,
    `> Generated from [\`${page.source}\`](${sourceUrl}) in the repository. Edit it there;` +
      ' changes made on this wiki are overwritten by the next sync.',
    '',
    rewriteLinks(normalized(markdown), links).trimEnd(),
    '',
  ].join('\n');
}

/** The sidebar: every page by title, child pages indented under their parent. */
export function renderSidebar(pages: readonly WikiPage[], repo: RepoLinks): string {
  const lines = pages
    .filter((page) => !page.parent)
    .flatMap((page) => [
      entry(page, ''),
      ...pages.filter((child) => child.parent === page.name).map((child) => entry(child, '  ')),
    ]);
  return [
    `${MARKER}: generated from server/wiki/wiki-pages.ts; edit it there -->`,
    ...lines,
    '',
    `Generated from [/docs](${repo.repoUrl}/tree/${repo.branch}/docs).`,
    '',
  ].join('\n');
}

function entry(page: WikiPage, indent: string): string {
  return `${indent}- [${page.title}](${page.name})`;
}

function normalized(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n');
}
