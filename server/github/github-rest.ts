import { type GraphQlConfig, clip, githubHeaders } from './github-graphql.ts';

/** One REST request to GitHub: its answer as text, or an error saying why not. */
export type Rest = (request: RestRequest) => Promise<string>;

export interface RestRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** From the API's root, `/repos/owner/name/...`. */
  readonly path: string;
  readonly body?: unknown;
  /** A media type other than JSON, such as a diff. */
  readonly accept?: string;
}

const API_ROOT = 'https://api.github.com';
/** Asks GitHub for a pull request's or a commit's changes as a unified diff. */
export const DIFF_MEDIA_TYPE = 'application/vnd.github.diff';

/** GitHub's REST API with the same token as its GraphQL one: for what GraphQL
 *  cannot do, such as a pull request's diff or a merge pinned to a commit. */
export function githubRest(config: GraphQlConfig): Rest {
  const { token, fetch: send = fetch } = config;
  if (!token) throw new Error('reading GitHub needs GITHUB_TOKEN');
  return async ({ method, path, body, accept }) => {
    const response = await send(`${API_ROOT}${path}`, {
      method,
      headers: githubHeaders(token, accept),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(clip(`GitHub: HTTP ${response.status} ${text}`.trim()));
    return text;
  };
}
