import { type ApiHandler, json } from '../http/api-handler.ts';
import { RUNS_PATH } from './runs-routes.ts';

const HTTP_FORBIDDEN = 403;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether `address` (a Host header, or an Origin's host) names this machine. */
function isLoopback(address: string | null): boolean {
  if (!address) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(`http://${address}`).hostname);
  } catch {
    return false;
  }
}

const originHost = (origin: string): string | null => {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
};

/**
 * Whether a runs request came from this machine's own page. A foreign Host is
 * a page on another site that rebound its name to 127.0.0.1 (DNS rebinding),
 * and could then send the write header as if it were Observatory's own page.
 * Browsers send Origin with every POST and DELETE, and with a GET only across
 * origins, so only a GET may arrive without one. Any loopback port counts,
 * since `ng serve` serves the page from its own port and proxies to this one.
 */
function isFromThisMachine(request: Request): boolean {
  if (!isLoopback(request.headers.get('host'))) return false;
  const origin = request.headers.get('origin');
  if (!origin) return request.method === 'GET';
  return isLoopback(originHost(origin));
}

/** `handle`, with the runs routes refused to anything but this machine's own page. */
export function guardRuns(handle: ApiHandler): ApiHandler {
  return async (request) => {
    const isRuns = new URL(request.url).pathname === RUNS_PATH;
    if (isRuns && !isFromThisMachine(request)) return json(HTTP_FORBIDDEN, { error: 'forbidden' });
    return handle(request);
  };
}
