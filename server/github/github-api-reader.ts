import type { GitHub } from './github.ts';
import { PULL_REQUEST_FIELDS, type PullRequest, type RepoRef } from './github-reader.ts';
import { githubApiWriter } from './github-api-writer.ts';
import { type GraphQl, type GraphQlConfig, githubGraphQl } from './github-graphql.ts';
import { githubRest } from './github-rest.ts';
import { ISSUE_GRAPHQL, PULL_GRAPHQL, nodesOf, selectionOf } from './graphql-fields.ts';
import {
  CLOSING_PULL_FIELDS,
  type ClosingPull,
  RAW_ISSUE_DETAIL_FIELDS,
  RAW_ISSUE_FIELDS,
  type RawIssue,
  type RawIssueDetail,
} from './issue-reader.ts';
import { type ListedFiles, pullFilesOf } from './listed-files.ts';
import { PULL_DETAIL_FIELDS, type RawLabel, type RawPull } from './pull-reader.ts';
import { QUEUE_PULL_FIELDS, type QueuePull } from './queue-reader.ts';
import { AGENT_PULL_FIELDS, type AgentPull } from '../agents/agents-report.ts';
import { LEDGER_PULL_FIELDS, type LedgerPull, byNumberDescending } from '../history/ledger.ts';

/** The same limits the `gh` reader asks for, so both see the same lists. */
const PULL_LIMIT = 100;
const ISSUE_LIMIT = 1000;
const REPO_LIMIT = 1000;
const PAGE_SIZE = 100;
const LABEL_LIMIT = 100;
const DIFF_MEDIA_TYPE = 'application/vnd.github.diff';
/** As the `gh` reader asks for: sixty days of a busy repository. */
const LEDGER_LIMIT = 400;
/** As the `gh` reader asks for: enough for the agents' report cards. */
const AGENT_LIMIT = 500;

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
  const rest = githubRest(config);
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

  /** Every pull request, open or not, newest first, as `gh pr list --state all` lists them. */
  async function allPulls(repo: string, fields: readonly string[], limit: number): Promise<Node[]> {
    const { select, shape } = selectionOf(PULL_GRAPHQL, fields);
    const nodes = await allPages(async (after) => {
      const repository = await repositoryOf(
        `query($owner: String!, $name: String!, $first: Int!, $after: String) {
          repository(owner: $owner, name: $name) {
            pullRequests(first: $first, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
              pageInfo { hasNextPage endCursor }
              nodes { ${select} }
            }
          }
        }`,
        { ...repoVariables(repo), first: PAGE_SIZE, after },
      );
      return pageOf(repository['pullRequests']);
    }, limit);
    return nodes.map(shape);
  }

  /** Every pull request updated since a day, through search, as `gh pr list --search` finds them. */
  async function touchedPulls(repo: string, sinceDay: string): Promise<Node[]> {
    const { select, shape } = selectionOf(PULL_GRAPHQL, LEDGER_PULL_FIELDS);
    const nodes = await allPages(async (after) => {
      const data = await graphql(
        `query($query: String!, $first: Int!, $after: String) {
          search(query: $query, type: ISSUE, first: $first, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { ... on PullRequest { ${select} } }
          }
        }`,
        { query: `repo:${repo} is:pr updated:>=${sinceDay}`, first: PAGE_SIZE, after },
      );
      return pageOf(asNode(data)['search']);
    }, LEDGER_LIMIT);
    return nodes.map(shape);
  }

  async function oneIssue(repo: string, number: number, fields: readonly string[]): Promise<Node> {
    const { select, shape } = selectionOf(ISSUE_GRAPHQL, fields);
    const repository = await repositoryOf(
      `query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) { issue(number: $number) { ${select} } }
      }`,
      { ...repoVariables(repo), number },
    );
    if (!repository['issue']) throw new Error(`GitHub: ${repo} has no issue ${number}`);
    return shape(repository['issue']);
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

  /** Issues closed on or after `sinceDay`, found the way `gh issue list --search` finds them. */
  async function closedIssues(
    repo: string,
    sinceDay: string,
    fields: readonly string[],
  ): Promise<Node[]> {
    const { select, shape } = selectionOf(ISSUE_GRAPHQL, fields);
    const nodes = await allPages(async (after) => {
      const data = await graphql(
        `query($query: String!, $last: Int!, $after: String) {
          search(type: ISSUE_ADVANCED, last: $last, after: $after, query: $query) {
            pageInfo { hasNextPage endCursor }
            nodes { ... on Issue { ${select} } }
          }
        }`,
        {
          query: `( closed:>=${sinceDay} ) repo:${repo} state:closed type:issue`,
          last: PAGE_SIZE,
          after,
        },
      );
      return pageOf(asNode(data)['search']);
    }, ISSUE_LIMIT);
    return nodes.map(shape);
  }

  return {
    ...githubApiWriter(graphql, rest),
    viewer: async () =>
      String(asNode(asNode(await graphql('query { viewer { login } }'))['viewer'])['login']),
    ownedRepos: (owner) => ownedRepos(graphql, owner),
    openPulls: async (repo) => shaped<PullRequest>(await openPulls(repo, PULL_REQUEST_FIELDS)),
    queuePulls: async (repo) => shaped<QueuePull>(await openPulls(repo, QUEUE_PULL_FIELDS)),
    closingPulls: async (repo) => shaped<ClosingPull>(await openPulls(repo, CLOSING_PULL_FIELDS)),
    agentPulls: async (repo) =>
      shaped<AgentPull>(await allPulls(repo, AGENT_PULL_FIELDS, AGENT_LIMIT)),
    touchedPulls: async (repo, sinceDay) =>
      byNumberDescending(shaped<LedgerPull>(await touchedPulls(repo, sinceDay))),
    pullFiles: async (repo) =>
      pullFilesOf(shaped<ListedFiles>(await openPulls(repo, ['number', 'files']))),
    pullDetail: async (repo, number) =>
      shaped<RawPull>([await onePull(repo, number, PULL_DETAIL_FIELDS)])[0],
    pullDiff: (repo, number) =>
      rest({ method: 'GET', path: `/repos/${repo}/pulls/${number}`, accept: DIFF_MEDIA_TYPE }),
    repoLabels: async (repo) => {
      const repository = await repositoryOf(
        `query($owner: String!, $name: String!, $first: Int!) {
          repository(owner: $owner, name: $name) { labels(first: $first) { nodes { name color } } }
        }`,
        { ...repoVariables(repo), first: LABEL_LIMIT },
      );
      return shaped<RawLabel>(nodesOf(repository['labels']));
    },
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
    issueDetail: async (repo, number) =>
      shaped<RawIssueDetail>([await oneIssue(repo, number, RAW_ISSUE_DETAIL_FIELDS)])[0],
    closedIssues: async (repo, sinceDay) =>
      shaped<RawIssue>(await closedIssues(repo, sinceDay, RAW_ISSUE_FIELDS)),
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
