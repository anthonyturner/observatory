import { isObject, isText, listOf, oneOf } from '../json/json-fields';

/** Where the pages came from: the wiki, the README and `docs/` where there is none, or neither. */
export type LibrarySource = 'wiki' | 'docs' | 'none';

export interface LibraryPage {
  /** The page's part of its Library URL. */
  readonly slug: string;
  readonly title: string;
  /** The shelf it sits on in the index. */
  readonly shelf: string;
  /** The page on GitHub. */
  readonly url: string;
  readonly markdown: string;
}

/** What `GET /api/library` returns. */
export interface LibraryReport {
  readonly generatedAt: number;
  readonly repo: string;
  readonly source: LibrarySource;
  /** The wiki, or the repository's files, on GitHub. */
  readonly url: string;
  /** In reading order. */
  readonly pages: readonly LibraryPage[];
  readonly isTruncated: boolean;
}

const SOURCES: readonly LibrarySource[] = ['wiki', 'docs', 'none'];
const isSource = oneOf(SOURCES);
const HTTPS = /^https:\/\//;

const linkOf = (value: unknown): string | null =>
  isText(value) && HTTPS.test(value) ? value : null;

function parsePage(value: unknown): LibraryPage | null {
  if (!isObject(value)) return null;
  const { slug, title, shelf, markdown } = value;
  const url = linkOf(value['url']);
  if (!isText(slug) || !isText(title) || !isText(shelf) || !url) return null;
  return { slug, title, shelf, url, markdown: typeof markdown === 'string' ? markdown : '' };
}

/** The report, checked field by field, or null when the answer is not one. */
export function parseLibraryReport(body: unknown): LibraryReport | null {
  if (!isObject(body) || !isText(body['repo']) || !isSource(body['source'])) return null;
  const generatedAt = isText(body['generatedAt']) ? Date.parse(body['generatedAt']) : NaN;
  const url = linkOf(body['url']);
  if (!Number.isFinite(generatedAt) || !url) return null;
  return {
    generatedAt,
    repo: body['repo'],
    source: body['source'],
    url,
    pages: listOf(body['pages'], parsePage),
    isTruncated: body['isTruncated'] === true,
  };
}
