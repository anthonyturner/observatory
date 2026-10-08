import { gitHubLinkOf, timeOf } from '../actions/actions-report';
import { isNumber, isObject, isText, listOf, oneOf } from '../json/json-fields';

/**
 * How a deployment stands: `ready` (live), `building` (queued or under way),
 * `failed`, `inactive` (a newer one replaced it) or `unknown` (no status yet).
 */
export type DeployOutcome = 'ready' | 'building' | 'failed' | 'inactive' | 'unknown';
export const DEPLOY_OUTCOMES: readonly DeployOutcome[] = [
  'ready',
  'building',
  'failed',
  'inactive',
  'unknown',
];

export interface Deployment {
  readonly id: number;
  readonly environment: string;
  readonly sha: string;
  /** The branch or tag it was asked for; null when that was the commit itself. */
  readonly ref: string | null;
  readonly creator: string | null;
  /** Milliseconds since the epoch. */
  readonly createdAt: number;
  readonly outcome: DeployOutcome;
  /** The deployer's own words for it. */
  readonly description: string | null;
  /** The deployed site. */
  readonly url: string | null;
  readonly logUrl: string | null;
  readonly commitUrl: string;
}

export interface DeployEnvironment {
  readonly name: string;
  readonly isProduction: boolean;
  /** Its deployment history on GitHub. */
  readonly url: string;
  /** Newest first: the first is its latest. */
  readonly deployments: readonly Deployment[];
}

/** What `GET /api/deployments` returns. */
export interface DeploymentsReport {
  readonly generatedAt: number;
  readonly repo: string;
  /** Production first, then the most recently deployed. */
  readonly environments: readonly DeployEnvironment[];
}

/** What `GET /api/deployments/preview` returns: what one commit was deployed as. */
export interface PullPreview {
  readonly sha: string;
  /** The newest deployment of the commit to each environment. */
  readonly deployments: readonly Deployment[];
}

const isDeployOutcome = oneOf(DEPLOY_OUTCOMES);
/** The deployer sets the site's and the log's links, so only a web page is drawn as a link. */
const WEB_LINK = /^https?:\/\//i;

const webLinkOf = (value: unknown): string | null =>
  isText(value) && WEB_LINK.test(value) ? value : null;
const textOrNull = (value: unknown): string | null => (isText(value) ? value : null);

export function parseDeployment(value: unknown): Deployment | null {
  if (!isObject(value)) return null;
  const { id, environment, sha, outcome } = value;
  const createdAt = timeOf(value['createdAt']);
  const commitUrl = gitHubLinkOf(value['commitUrl']);
  if (!isNumber(id) || !isText(environment) || !isText(sha) || !isDeployOutcome(outcome)) {
    return null;
  }
  if (createdAt === null || !commitUrl) return null;
  return {
    id,
    environment,
    sha,
    ref: textOrNull(value['ref']),
    creator: textOrNull(value['creator']),
    createdAt,
    outcome,
    description: textOrNull(value['description']),
    url: webLinkOf(value['url']),
    logUrl: webLinkOf(value['logUrl']),
    commitUrl,
  };
}

function parseEnvironment(value: unknown): DeployEnvironment | null {
  if (!isObject(value) || !isText(value['name'])) return null;
  const url = gitHubLinkOf(value['url']);
  if (!url) return null;
  return {
    name: value['name'],
    isProduction: value['isProduction'] === true,
    url,
    deployments: listOf(value['deployments'], parseDeployment),
  };
}

/** The report, checked field by field, or null when the answer is not one. */
export function parseDeploymentsReport(body: unknown): DeploymentsReport | null {
  if (!isObject(body) || !isText(body['repo'])) return null;
  const generatedAt = timeOf(body['generatedAt']);
  if (generatedAt === null) return null;
  return {
    generatedAt,
    repo: body['repo'],
    environments: listOf(body['environments'], parseEnvironment),
  };
}

/** A commit's deployments, checked, or null when the answer is not one. */
export function parsePullPreview(body: unknown): PullPreview | null {
  if (!isObject(body) || !isText(body['sha'])) return null;
  return { sha: body['sha'], deployments: listOf(body['deployments'], parseDeployment) };
}

/** Something is still queued or under way, so it is worth asking again soon. */
export const isBuilding = (deployments: readonly Deployment[]): boolean =>
  deployments.some((deployment) => deployment.outcome === 'building');

/** Each environment's latest deployment is still building somewhere. */
export const isReportBuilding = (report: DeploymentsReport): boolean =>
  report.environments.some((environment) => environment.deployments[0]?.outcome === 'building');

/** "92b4594": a commit as GitHub abbreviates it. */
export const shortSha = (sha: string): string => sha.slice(0, 7);
