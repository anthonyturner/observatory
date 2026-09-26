import type { ApiHandler } from '../http/api-handler.ts';
import { type HostedDependencies, hostedApi } from './hosted-api.ts';
import type { Env, HostedConfig } from './hosted-config.ts';

/** vercel.json rewrites every `/api/*` request to the one function, carrying the rest of its path here. */
const PATH_PARAM = '__path';

/** The request as the browser sent it, before vercel.json's rewrite moved its path into `__path`. */
export async function originalRequest(request: Request): Promise<Request> {
  const url = new URL(request.url);
  const path = url.searchParams.get(PATH_PARAM);
  if (path === null) return request;
  url.pathname = `/api/${path}`;
  url.searchParams.delete(PATH_PARAM);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
  });
}

/**
 * The whole hosted API as one Vercel function. It is built on the first
 * request and kept while the instance lives, so its caches serve the requests
 * that follow.
 */
export function vercelFunction(
  env: Env,
  dependencies?: (config: HostedConfig) => HostedDependencies,
): ApiHandler {
  let handle: ApiHandler | null = null;
  return async (request) => {
    handle ??= hostedApi(env, dependencies);
    return handle(await originalRequest(request));
  };
}
