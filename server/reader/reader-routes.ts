import { BadRequest, type RouteTable } from '../http/api-handler.ts';
import { urlProblem } from './address-guard.ts';
import { type PageFetcher, ReadError } from './page-fetch.ts';
import { readablePage } from './readable.ts';

export const READ_PATH = '/api/read';

const MAX_URL_LENGTH = 2048;

function urlOf(query: URLSearchParams): URL {
  const said = query.get('url') ?? '';
  if (!said || said.length > MAX_URL_LENGTH) throw new BadRequest('bad request: no url');
  try {
    return new URL(said);
  } catch {
    throw new BadRequest('bad request: not a url');
  }
}

/**
 * `table` with the reader, which fetches a page for the floating reader window:
 *
 *   GET /api/read?url=…   the readable page, or { failed } saying why not
 *
 * Only public http(s) pages are read (see address-guard.ts), and only for
 * this machine's own page: main.ts guards the path.
 */
export function withReaderRoutes(table: RouteTable, fetchPage: PageFetcher): RouteTable {
  const read = async (query: URLSearchParams): Promise<unknown> => {
    const url = urlOf(query);
    const problem = urlProblem(url);
    if (problem) return { url: url.toString(), failed: problem };
    try {
      const page = await fetchPage(url);
      return readablePage(page.html, page.url, page.headers);
    } catch (error) {
      if (!(error instanceof ReadError)) throw error;
      return { url: url.toString(), failed: error.words };
    }
  };
  return { ...table, get: { ...table.get, [READ_PATH]: read } };
}
