import type { GitHub } from './github.ts';
import { PULL_REQUEST_FIELDS, type PullRequest, type RepoRef } from './github-reader.ts';
import { type GraphQl, type GraphQlConfig, githubGraphQl } from './github-graphql.ts';
import { ISSUE_GRAPHQL, PULL_GRAPHQL, nodesOf, selectionOf } from './graphql-fields.ts';
import { type ClosingPull, RAW_ISSUE_FIELDS, type RawIssue } from './issue-reader.ts';
import { type ListedFiles, pullFilesOf } from './listed-files.ts';
import { PULL_DETAIL_FIELDS, type RawPull } from './pull-reader.ts';
import { QUEUE_PULL_FIELDS, type QueuePull } from './queue-reader.ts';

/** The same limits the `gh` reader asks for, so both see the same lists. */
const PULL_LIMIT = 100;
const ISSUE_LIMIT = 1000;
const REPO_LIMIT = 1000;
const PAGE_SIZE = 100;

type Node = Readonly<Record<string, unknown>>;

const asNode = (value: unknown): Node =>
  typeof value === 'object' && value !== null ? (value as Node) : {};

/** `owner/name` as GraphQL variables; the route has already checked the name. */
function repoVariables(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split('/');
  return { owner, name };
}

/**
 * Nodes shaped by the field table into the `gh --json` shape `T` names. The
 * table is what makes them that shape, so this is the one place the type is
 * taken on trust, as the `gh` reader takes `gh`'s output.
 */
const shaped = <T>(nodes: readonly Node[]): T[] => nodes as unknown as T[];

interface Page {
  readonly nodes: Node[];
  readonly next: string | null;
}

function pageOf(connection: unknown): Page {
  const info = asNode(asNode(connection)['pageInfo']);
  return {
    nodes: nodesOf(connection),
    next: info['hasNextPage'] === true ? String(info['endCursor']) : null,
  };
}

/** Reads `load` a page at a time until there are no more or `limit` are in. */
async function allPages(load: (after: string | null) => Promise<Page>, limit: number) {
  const nodes: Node[] = [];
  let after: string | null = null;
  do {
    const page = await load(after);
    nodes.push(...page.nodes);
    after = page.next;
  } while (after && nodes.length < limit);
  return nodes.slice(0, limit);
}

/** GitHub through its GraphQL API with a token the server holds: what the
 *  hosted site uses where this machine uses `gh`. */
export function githubApiReader(config: GraphQlConfig): GitHub {
  const graphql = githubGraphQl(config);
  const repositoryOf = async (query: string, variables: Node): Promise<Node> =>
    asNode(asNode(await graphql(query, variables))['repository']);

  async function openPulls(repo: string, fields: readonly string[]): Promise<Node[]> {
    const { select, shape } = selectionOf(PULL_GRAPHQL, fields);
    const repository = await repositoryOf(
      `query($owner: String!, $name: String!, $first: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequests(states: OPEN, first: $first, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes { ${select} }
          }
        }
      }`,
      { ...repoVariables(repo), first: PULL_LIMIT },
    );
    return nodesOf(repository['pullRequests']).map(shape);
  }

  async function onePull(repo: string, number: number, fields: readonly string[]): Promise<Node> {
    const { select, shape } = selectionOf(PULL_GRAPHQL, fields);
    const repository = await repositoryOf(
      `query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) { pullRequest(number: $number) { ${select} } }
      }`,
      { ...repoVariables(repo), number },
    );
    if (!repository['pullRequest'])
      throw new Error(`GitHub: ${repo} has no pull request ${number}`);
    return shape(repository['pullRequest']);
  }

  /** Open issues with `fields`, or null when the repository has issues switched off. */
  async function openIssues(repo: string, fields: readonly string[]): Promise<Node[] | null> {
    const { select, shape } = selectionOf(ISSUE_GRAPHQL, fields);
    let enabled = true;
    const nodes = await allPages(async (after) => {
      const repository = await repositoryOf(
        `query($owner: String!, $name: String!, $first: Int!, $after: String) {
          repository(owner: $owner, name: $name) {
            hasIssuesEnabled
            issues(states: OPEN, first: $first, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
              pageInfo { hasNextPage endCursor }
              nodes { ${select} }
            }
          }
        }`,
        { ...repoVariables(repo), first: PAGE_SIZE, after },
      );
      enabled = repository['hasIssuesEnabled'] !== false;
      return enabled ? pageOf(repository['issues']) : { nodes: [], next: null };
    }, ISSUE_LIMIT);
    return enabled ? nodes.map(shape) : null;
  }

  return {
    viewer: async () =>
      String(asNode(asNode(await graphql('query { viewer { login } }'))['viewer'])['login']),
    ownedRepos: (owner) => ownedRepos(graphql, owner),
    openPulls: async (repo) => shaped<PullRequest>(await openPulls(repo, PULL_REQUEST_FIELDS)),
    queuePulls: async (repo) => shaped<QueuePull>(await openPulls(repo, QUEUE_PULL_FIELDS)),
    closingPulls: async (repo) =>
      shaped<ClosingPull>(await openPulls(repo, ['number', 'closingIssuesReferences'])),
    pullFiles: async (repo) =>
      pullFilesOf(shaped<ListedFiles>(await openPulls(repo, ['number', 'files']))),
    pullDetail: async (repo, number) =>
      shaped<RawPull>([await onePull(repo, number, PULL_DETAIL_FIELDS)])[0],
    pullState: async (repo, pull) => String((await onePull(repo, pull, ['state']))['state']),
    mergeableOf: async (repo, pull) =>
      String((await onePull(repo, pull, ['mergeable']))['mergeable']),
    openIssueNumbers: async (repo) =>
      (await openIssues(repo, ['number']))?.map((issue) => Number(issue['number'])) ?? null,
    openIssues: async (repo) => {
      const issues = await openIssues(repo, RAW_ISSUE_FIELDS);
      // As `gh issue list` does, rather than an empty list that looks like none.
      if (!issues) throw new Error(`GitHub: the repository ${repo} has disabled issues`);
      return shaped<RawIssue>(issues);
    },
    closedSinceCount: async (repo, sinceDay) => {
      const data = await graphql(
        `
          query ($query: String!) {
            search(query: $query, type: ISSUE, first: 1) {
              issueCount
            }
          }
        `,
        { query: `repo:${repo} is:issue is:closed closed:>=${sinceDay}` },
      );
      // `gh` counts at most the list it was asked for.
      return Math.min(Number(asNode(asNode(data)['search'])['issueCount']), ISSUE_LIMIT);
    },
  };
}

/** Source repositories the owner has, as `gh repo list --source --no-archived`
 *  lists them: no forks, no archives, most recently pushed first. */
async function ownedRepos(graphql: GraphQl, owner: string): Promise<RepoRef[]> {
  const nodes = await allPages(async (after) => {
    const data = await graphql(
      `
        query ($owner: String!, $first: Int!, $after: String) {
          repositoryOwner(login: $owner) {
            repositories(
              first: $first
              after: $after
              ownerAffiliations: OWNER
              isFork: false
              isArchived: false
              orderBy: { field: PUSHED_AT, direction: DESC }
            ) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                name
                nameWithOwner
                isPrivate
              }
            }
          }
        }
      `,
      { owner, first: PAGE_SIZE, after },
    );
    const account = asNode(data)['repositoryOwner'];
    if (!account) throw new Error(`GitHub: no account called ${owner}`);
    return pageOf(asNode(account)['repositories']);
  }, REPO_LIMIT);
  return shaped<RepoRef>(nodes);
}
