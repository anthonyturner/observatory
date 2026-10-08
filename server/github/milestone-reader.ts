import { type GraphQl, repoVariables } from './github-graphql.ts';
import { nodesOf } from './graphql-fields.ts';
import { field, totalIn } from './graphql-answer.ts';
import { isText } from './rest-json.ts';

/** How an issue or pull request on a milestone stands. */
export type MilestoneItemState = 'open' | 'closed' | 'merged';

/** One issue or pull request on a milestone. */
export interface MilestoneItemMark {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly isPull: boolean;
  readonly state: MilestoneItemState;
}

/** One milestone, with how many of its issues and pull requests are open and done. */
export interface MilestoneMark {
  readonly number: number;
  readonly title: string;
  readonly description: string | null;
  readonly url: string;
  readonly isOpen: boolean;
  readonly dueOn: string | null;
  readonly closedAt: string | null;
  readonly openIssues: number;
  readonly closedIssues: number;
  readonly openPulls: number;
  /** Merged or closed. */
  readonly closedPulls: number;
  /** The most recently updated of its issues and pull requests, at most `ITEM_LIMIT` of each. */
  readonly items: readonly MilestoneItemMark[];
}

/** What the Milestones screen reads of a repository's milestones, and nothing else. */
export interface MilestoneReader {
  /** The open milestones, and the few closed most lately. */
  milestones(repo: string): Promise<MilestoneMark[]>;
}

/** More open milestones than this is a backlog, not a plan; the screen names the first. */
export const OPEN_LIMIT = 25;
/** Enough closed ones to show what just landed. */
export const CLOSED_LIMIT = 5;
/** Of each kind, per milestone: a long milestone lists its newest, and counts the rest. */
export const ITEM_LIMIT = 30;

const ITEM_FIELDS = `nodes { number title url state }`;
const RECENT_FIRST = `orderBy: { field: UPDATED_AT, direction: DESC }`;

// GitHub fails the whole query ("Something went wrong") on a large repository when a
// milestone's pull requests are given any order, so they come as GitHub keeps them: the
// last are the newest opened.
const MILESTONE_FIELDS = `
  number title description url state dueOn closedAt
  openIssues: issues(states: OPEN) { totalCount }
  closedIssues: issues(states: CLOSED) { totalCount }
  openPulls: pullRequests(states: OPEN) { totalCount }
  closedPulls: pullRequests(states: [CLOSED, MERGED]) { totalCount }
  issues(first: ${ITEM_LIMIT}, ${RECENT_FIRST}) { ${ITEM_FIELDS} }
  pullRequests(last: ${ITEM_LIMIT}) { ${ITEM_FIELDS} }`;

export const MILESTONES_QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    open: milestones(states: OPEN, first: ${OPEN_LIMIT}, orderBy: { field: DUE_DATE, direction: ASC }) {
      nodes { ${MILESTONE_FIELDS} }
    }
    closed: milestones(states: CLOSED, first: ${CLOSED_LIMIT}, ${RECENT_FIRST}) {
      nodes { ${MILESTONE_FIELDS} }
    }
  }
}`;

const ITEM_STATES: Readonly<Record<string, MilestoneItemState>> = {
  OPEN: 'open',
  CLOSED: 'closed',
  MERGED: 'merged',
};

type Node = Readonly<Record<string, unknown>>;

const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);

function itemOf(node: Node, isPull: boolean): MilestoneItemMark | null {
  const { number, title, url } = node;
  const state = ITEM_STATES[String(node['state'])];
  if (!Number.isInteger(number) || !isText(title) || !isText(url) || !state) return null;
  return { number: Number(number), title, url, isPull, state };
}

const itemsIn = (connection: unknown, isPull: boolean): MilestoneItemMark[] =>
  nodesOf(connection)
    .map((node) => itemOf(node, isPull))
    .filter((item) => item !== null);

function milestoneOf(node: Node): MilestoneMark | null {
  const { number, title, url } = node;
  if (!Number.isInteger(number) || !isText(title) || !isText(url)) return null;
  return {
    number: Number(number),
    title,
    description: textOrNull(node['description']),
    url,
    isOpen: node['state'] === 'OPEN',
    dueOn: textOrNull(node['dueOn']),
    closedAt: textOrNull(node['closedAt']),
    openIssues: totalIn(node['openIssues']),
    closedIssues: totalIn(node['closedIssues']),
    openPulls: totalIn(node['openPulls']),
    closedPulls: totalIn(node['closedPulls']),
    items: [...itemsIn(node['issues'], false), ...itemsIn(node['pullRequests'], true)],
  };
}

/** The milestones in a `MILESTONES_QUERY` answer: the open ones, then the closed. */
export function milestonesOf(data: unknown): MilestoneMark[] {
  const repository = field(data, 'repository');
  return [...nodesOf(field(repository, 'open')), ...nodesOf(field(repository, 'closed'))]
    .map(milestoneOf)
    .filter((mark) => mark !== null);
}

/** The reader over one way of asking GitHub's GraphQL API. */
export const milestoneReader = (graphql: GraphQl): MilestoneReader => ({
  milestones: async (repo) => milestonesOf(await graphql(MILESTONES_QUERY, repoVariables(repo))),
});
