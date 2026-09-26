/** One GraphQL request to GitHub: the `data` it answered, or an error saying why not. */
export type GraphQl = (
  query: string,
  variables?: Readonly<Record<string, unknown>>,
) => Promise<unknown>;

export interface GraphQlConfig {
  /** A token the server holds; it is sent to GitHub and nowhere else. */
  readonly token: string;
  readonly fetch?: typeof fetch;
}

const ENDPOINT = 'https://api.github.com/graphql';
const API_VERSION = '2022-11-28';
const USER_AGENT = 'observatory';
const MAX_ERROR_LENGTH = 400;

interface GraphQlError {
  readonly message?: string;
  readonly type?: string;
  readonly path?: readonly (string | number)[];
}

interface GraphQlReply {
  readonly data?: unknown;
  readonly errors?: readonly GraphQlError[];
  readonly message?: string;
}

/** Fields a reply may be missing: GitHub leaves them null when the token may not read them,
 *  and the readers already take null for them (a check run no workflow started). */
const OPTIONAL_FIELDS: ReadonlySet<string> = new Set(['workflowRun']);

const isOptionalRefusal = (error: GraphQlError): boolean =>
  error.type === 'FORBIDDEN' && OPTIONAL_FIELDS.has(String(error.path?.at(-1)));

const describe = (error: GraphQlError): string =>
  `${error.message ?? 'unknown error'}${error.path ? ` (at ${error.path.join('.')})` : ''}`;

export const clip = (text: string): string => text.slice(0, MAX_ERROR_LENGTH);

/** What every request to GitHub's API carries: the token, and what it answers in. */
export function githubHeaders(token: string, accept = 'application/vnd.github+json'): Headers {
  return new Headers({
    authorization: `Bearer ${token}`,
    accept,
    'content-type': 'application/json',
    'x-github-api-version': API_VERSION,
    'user-agent': USER_AGENT,
  });
}

function replyOf(text: string): GraphQlReply {
  try {
    const reply: unknown = JSON.parse(text);
    return typeof reply === 'object' && reply !== null ? reply : {};
  } catch {
    return { message: text };
  }
}

/** GitHub's GraphQL API with a token, over plain `fetch`. A partial answer
 *  with errors is an error: a report is never built from half a reply. The one
 *  exception is a refusal of an optional field alone, which is left null. */
export function githubGraphQl(config: GraphQlConfig): GraphQl {
  const { token, fetch: send = fetch } = config;
  if (!token) throw new Error('reading GitHub needs GITHUB_TOKEN');
  return async (query, variables = {}) => {
    const response = await send(ENDPOINT, {
      method: 'POST',
      headers: githubHeaders(token),
      body: JSON.stringify({ query, variables }),
    });
    const reply = replyOf(await response.text());
    if (!response.ok) {
      throw new Error(clip(`GitHub: HTTP ${response.status} ${reply.message ?? ''}`.trim()));
    }
    if (reply.errors?.length && !reply.errors.every(isOptionalRefusal)) {
      throw new Error(clip(`GitHub: ${reply.errors.map(describe).join('; ')}`));
    }
    if (typeof reply.data !== 'object' || reply.data === null) {
      throw new Error('GitHub: an answer with no data');
    }
    return reply.data;
  };
}
