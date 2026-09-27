import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import { isPublicAddress, urlProblem } from './address-guard.ts';

/** A page as fetched: where it ended up, its headers, and its HTML. */
export interface FetchedPage {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly html: string;
}

/** Why a page could not be read, in words for the reader window. */
export class ReadError extends Error {
  readonly words: string;

  constructor(words: string) {
    super(words);
    this.name = 'ReadError';
    this.words = words;
  }
}

export type PageFetcher = (url: URL) => Promise<FetchedPage>;

const MAX_REDIRECTS = 4;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const HTTP_REDIRECTS: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);
/** Some sites refuse a request that does not look like a browser's. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36 Observatory-Reader';

/** Resolves as usual, then refuses the connection when any address is not
 *  public. The check is on the address the socket will use, not an earlier
 *  lookup, so a name cannot resolve publicly for a check and privately for the call. */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '', 0);
    const refused = addresses.find((entry) => !isPublicAddress(entry.address));
    if (refused || !addresses.length) {
      return callback(
        new ReadError('addresses on this machine or its network cannot be read'),
        '',
        0,
      );
    }
    if (options.all)
      return (callback as unknown as (e: null, all: LookupAddress[]) => void)(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
};

function headersOf(response: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(response.headers)) {
    if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(', ') : value;
  }
  return headers;
}

/** One request, no redirects followed: the status, headers and, for HTML, the body. */
function requestOnce(
  url: URL,
): Promise<{ status: number; headers: Record<string, string>; html: string }> {
  const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const request = send(
      url,
      {
        method: 'GET',
        lookup: publicOnlyLookup,
        timeout: TIMEOUT_MS,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
          'accept-encoding': 'identity',
          'accept-language': 'en',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const headers = headersOf(response);
        const type = headers['content-type'] ?? '';
        if (HTTP_REDIRECTS.has(status) || status >= 400 || !/html/i.test(type)) {
          response.resume();
          resolve({ status, headers, html: '' });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            request.destroy(new ReadError('the page is too large to read here'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () =>
          resolve({ status, headers, html: Buffer.concat(chunks).toString('utf8') }),
        );
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new ReadError('the site took too long to answer')));
    request.on('error', reject);
    request.end();
  });
}

/** Fetches `url` as the reader may: each hop checked, redirects followed a few
 *  times, HTML only. Fails with a ReadError that says why in words. */
export const fetchPage: PageFetcher = async (url) => {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const problem = urlProblem(current);
    if (problem) throw new ReadError(problem);
    let answer: Awaited<ReturnType<typeof requestOnce>>;
    try {
      answer = await requestOnce(current);
    } catch (error) {
      if (error instanceof ReadError) throw error;
      throw new ReadError('the site could not be reached');
    }
    const { status, headers, html } = answer;
    if (HTTP_REDIRECTS.has(status)) {
      const location = headers['location'];
      if (!location) throw new ReadError('the site sent a redirect with nowhere to go');
      current = new URL(location, current);
      continue;
    }
    if (status >= 400) throw new ReadError(`the site answered ${status}`);
    if (!html) throw new ReadError('that link is not a web page');
    return { url: current.toString(), headers, html };
  }
  throw new ReadError('the site redirected too many times');
};
