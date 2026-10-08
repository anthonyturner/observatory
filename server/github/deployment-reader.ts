import { type Json, type JsonGet, isJson, isText, jsonList, jsonListIn } from './rest-json.ts';

/** Every state GitHub gives a deployment status. */
const DEPLOYMENT_STATES = [
  'error',
  'failure',
  'inactive',
  'in_progress',
  'queued',
  'pending',
  'success',
] as const;
export type DeploymentState = (typeof DEPLOYMENT_STATES)[number];

/** One deployment, as asked for: which environment, and which commit. */
export interface DeploymentMark {
  readonly id: number;
  readonly environment: string;
  readonly sha: string;
  /** The branch, tag or commit it was asked for; Vercel gives the commit. */
  readonly ref: string;
  readonly createdAt: string;
  /** Who made it: an app's account, such as `vercel[bot]`, more often than a person's. */
  readonly creator: string | null;
}

/** How a deployment stands, as its newest status says. */
export interface DeploymentStatusMark {
  readonly state: DeploymentState;
  /** The deployed site. */
  readonly environmentUrl: string | null;
  readonly logUrl: string | null;
  readonly description: string | null;
  readonly createdAt: string;
}

/** Which deployments to read: one environment's, or one commit's, newest first. */
export interface DeploymentQuery {
  readonly environment?: string;
  readonly sha?: string;
  readonly limit: number;
}

/** What the Deployments screen and the PR screen read of a repository's deployments, and nothing else. */
export interface DeploymentReader {
  /** The names of the repository's environments. */
  environments(repo: string): Promise<string[]>;
  deployments(repo: string, query: DeploymentQuery): Promise<DeploymentMark[]>;
  /** A deployment's newest status, or null before it has one. */
  deploymentStatus(repo: string, id: number): Promise<DeploymentStatusMark | null>;
}

/** One request's worth: GitHub lists at most a hundred a page. */
const MAX_PAGE = 100;
/** The deployer sets these links, so only a web page is kept as one. */
const WEB_LINK = /^https?:\/\//i;

const isDeploymentState = (value: unknown): value is DeploymentState =>
  typeof value === 'string' && (DEPLOYMENT_STATES as readonly string[]).includes(value);

const linkOr = (value: unknown): string | null =>
  isText(value) && WEB_LINK.test(value) ? value : null;

const loginOf = (account: unknown): string | null => {
  const login = isJson(account) ? account['login'] : null;
  return isText(login) ? login : null;
};

function deploymentOf(deployment: Json): DeploymentMark | null {
  const { id, environment, sha, ref, created_at: createdAt } = deployment;
  if (!Number.isInteger(id) || !isText(environment) || !isText(sha) || !isText(createdAt)) {
    return null;
  }
  return {
    id: Number(id),
    environment,
    sha,
    ref: isText(ref) ? ref : sha,
    createdAt,
    creator: loginOf(deployment['creator']),
  };
}

/** The names in a `GET /environments` answer. */
export function environmentNamesOf(body: unknown): string[] {
  return jsonListIn(body, 'environments').flatMap((environment) =>
    isText(environment['name']) ? [environment['name']] : [],
  );
}

/** The deployments in a `GET /deployments` answer, newest first. */
export function deploymentsOf(body: unknown): DeploymentMark[] {
  return jsonList(body)
    .map(deploymentOf)
    .filter((mark) => mark !== null)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** The first status in a `GET /statuses` answer, which GitHub lists newest first, or null. */
export function latestStatusOf(body: unknown): DeploymentStatusMark | null {
  const [status] = jsonList(body);
  if (!status || !isDeploymentState(status['state']) || !isText(status['created_at'])) return null;
  return {
    state: status['state'],
    environmentUrl: linkOr(status['environment_url']),
    logUrl: linkOr(status['log_url']),
    description: isText(status['description']) ? status['description'] : null,
    createdAt: status['created_at'],
  };
}

function deploymentsPath(repo: string, query: DeploymentQuery): string {
  const narrowing = [
    query.environment === undefined ? '' : `&environment=${encodeURIComponent(query.environment)}`,
    query.sha === undefined ? '' : `&sha=${encodeURIComponent(query.sha)}`,
  ].join('');
  return `repos/${repo}/deployments?per_page=${Math.min(query.limit, MAX_PAGE)}${narrowing}`;
}

/** The reader over one way of reading GitHub's REST API. */
export const deploymentReader = (get: JsonGet): DeploymentReader => ({
  environments: async (repo) =>
    environmentNamesOf(await get(`repos/${repo}/environments?per_page=${MAX_PAGE}`)),
  deployments: async (repo, query) => deploymentsOf(await get(deploymentsPath(repo, query))),
  deploymentStatus: async (repo, id) =>
    latestStatusOf(await get(`repos/${repo}/deployments/${id}/statuses?per_page=1`)),
});
