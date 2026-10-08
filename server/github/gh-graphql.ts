import type { GraphQl } from './github-graphql.ts';
import { isJson } from './rest-json.ts';

/** The arguments for one `gh api graphql` call: a string goes as it is, anything else typed. */
export function graphQlArgs(
  query: string,
  variables: Readonly<Record<string, unknown>> = {},
): string[] {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [name, value] of Object.entries(variables)) {
    if (value === undefined || value === null) continue;
    // `-F` would read a value starting with `@` as a file to send, so text always goes raw.
    args.push(typeof value === 'string' ? '-f' : '-F', `${name}=${String(value)}`);
  }
  return args;
}

/** The `data` of a `gh api graphql` answer; `gh` itself fails on an answer with errors. */
export function graphQlData(reply: unknown): unknown {
  const data = isJson(reply) ? reply['data'] : null;
  if (!isJson(data)) throw new Error('GitHub: an answer with no data');
  return data;
}

/** GitHub's GraphQL API through the `gh` CLI, as the account this machine signed it in with. */
export const ghGraphQl =
  (readJson: (args: readonly string[]) => Promise<unknown>): GraphQl =>
  async (query, variables) =>
    graphQlData(await readJson(graphQlArgs(query, variables)));
