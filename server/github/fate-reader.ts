import { type GraphQl, repoVariables } from './github-graphql.ts';
import { field, totalIn } from './graphql-answer.ts';
import { nodesOf } from './graphql-fields.ts';
import type { MergeMethod } from './pull-writer.ts';
import { isText } from './rest-json.ts';

/** How a pull request left the queue: a merge commit, a squash, or closed unmerged. */
export type How = 'merge' | 'squash' | 'closed';

/** What became of a pull request's review threads. */
export interface ThreadCounts {
  readonly resolved: number;
  readonly unresolved: number;
}

/** How a pull request ended, read once when it leaves the queue. */
export interface PullEnding {
  readonly how: How;
  readonly threads: ThreadCounts;
  /** The numbers of the issues it closed. */
  readonly closes: readonly number[];
}

/** Where one pull request stands now, and what it is called. */
export interface PullState {
  readonly state: 'OPEN' | 'MERGED' | 'CLOSED';
  readonly title: string;
  /** Present once the pull request has merged or closed. */
  readonly ending?: PullEnding;
}

/** Whether a pull request is open, merged or closed, and how it ended. */
export interface FateReader {
  pullState(repo: string, pull: number): Promise<PullState>;
}

/** Threads beyond this many are not counted; a pull request has few. */
const THREAD_LIMIT = 100;
const CLOSING_ISSUE_LIMIT = 20;

export const PULL_STATE_QUERY = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      state
      title
      mergeCommit { parents { totalCount } }
      closingIssuesReferences(first: ${CLOSING_ISSUE_LIMIT}) { nodes { number } }
      reviewThreads(first: ${THREAD_LIMIT}) { nodes { isResolved } }
    }
  }
}`;

/** The two ways to merge that leave a trace in the commit. A rebase puts each commit
 *  on the base one at a time, so it reads as a squash, as does a merge with no commit to inspect. */
export const howMerged = (method: MergeMethod): How => (method === 'merge' ? 'merge' : 'squash');

function threadsOf(connection: unknown): ThreadCounts {
  const resolved = nodesOf(connection).filter((node) => node['isResolved'] === true).length;
  return { resolved, unresolved: nodesOf(connection).length - resolved };
}

function endingOf(state: string, pull: unknown): PullEnding | undefined {
  if (state !== 'MERGED' && state !== 'CLOSED') return undefined;
  const parents = totalIn(field(field(pull, 'mergeCommit'), 'parents'));
  return {
    how: state === 'CLOSED' ? 'closed' : parents >= 2 ? 'merge' : 'squash',
    threads: threadsOf(field(pull, 'reviewThreads')),
    closes: nodesOf(field(pull, 'closingIssuesReferences'))
      .map((node) => node['number'])
      .filter((number): number is number => Number.isInteger(number)),
  };
}

/** The state in a `PULL_STATE_QUERY` answer, or null when GitHub has no such pull request. */
export function pullStateOf(data: unknown): PullState | null {
  const pull = field(field(data, 'repository'), 'pullRequest');
  const state = field(pull, 'state');
  const title = field(pull, 'title');
  if (state !== 'OPEN' && state !== 'MERGED' && state !== 'CLOSED') {
    return null;
  }
  const ending = endingOf(state, pull);
  return { state, title: isText(title) ? title : '', ...(ending && { ending }) };
}

/** The reader over one way of asking GitHub's GraphQL API, shared by `gh` and the token. */
export const fateReader = (graphql: GraphQl): FateReader => ({
  async pullState(repo, pull) {
    const state = pullStateOf(
      await graphql(PULL_STATE_QUERY, { ...repoVariables(repo), number: pull }),
    );
    if (!state) throw new Error(`GitHub: ${repo} has no pull request ${pull}`);
    return state;
  },
});
