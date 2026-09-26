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

interface GraphQlReply {
  readonly data?: unknown;
  readonly errors?: readonly { readonly message?: string }[];
  readonly message?: string;
}

const clip = (text: string): string => text.slice(0, MAX_ERROR_LENGTH);

function replyOf(text: string): GraphQlReply {
  try {
    const reply: unknown = JSON.parse(text);
    return typeof reply === 'object' && reply !== null ? reply : {};
  } catch {
    return { message: text };
  }
}

/** GitHub's GraphQL API with a token, over plain `fetch`. A partial answer
 *  with errors is an error: a report is never built from half a reply. */
export function githubGraphQl(config: GraphQlConfig): GraphQl {
  const { token, fetch: send = fetch } = config;
  if (!token) throw new Error('reading GitHub needs GITHUB_TOKEN');
  return async (query, variables = {}) => {
    const response = await send(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'x-github-api-version': API_VERSION,
        'user-agent': USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
    });
    const reply = replyOf(await response.text());
    if (!response.ok) {
      throw new Error(clip(`GitHub: HTTP ${response.status} ${reply.message ?? ''}`.trim()));
    }
    if (reply.errors?.length) {
      const messages = reply.errors.map((error) => error.message ?? 'unknown error');
      throw new Error(clip(`GitHub: ${messages.join('; ')}`));
    }
    if (typeof reply.data !== 'object' || reply.data === null) {
      throw new Error('GitHub: an answer with no data');
    }
    return reply.data;
  };
}
