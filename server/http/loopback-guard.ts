import { type ApiHandler, json } from './api-handler.ts';

const HTTP_FORBIDDEN = 403;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether `url` parses and its host names this machine, on any port. */
function isLoopbackUrl(url: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Whether the request's Host names this machine. A page on another site that
 * rebinds its own name to 127.0.0.1 (DNS rebinding) reaches this server with
 * that name as its Host, and the browser treats it as the same origin.
 */
export function hasLoopbackHost(request: Request): boolean {
  const host = request.headers.get('host');
  return host !== null && isLoopbackUrl(`http://${host}`);
}

/** Whether an Origin header names a page served from this machine. */
export function isLoopbackOrigin(origin: string): boolean {
  return isLoopbackUrl(origin);
}

/**
 * Whether a request came from this machine's own page. Browsers send Origin
 * with every POST and DELETE, and with a GET only across origins, so only a
 * GET may arrive without one. Any loopback port counts, since `ng serve`
 * serves the page from its own port and proxies to this one, passing the
 * page's Host and Origin through unchanged.
 */
function isFromThisMachine(request: Request): boolean {
  if (!hasLoopbackHost(request)) return false;
  const origin = request.headers.get('origin');
  if (!origin) return request.method === 'GET';
  return isLoopbackOrigin(origin);
}

/** `handle`, refusing anything but this machine's own page: the API reads the
 *  owner's files, acts as their `gh` account and runs code, and the write
 *  header alone is no defence against a rebound page. */
export function guardLoopback(handle: ApiHandler): ApiHandler {
  return async (request) =>
    isFromThisMachine(request) ? handle(request) : json(HTTP_FORBIDDEN, { error: 'forbidden' });
}
