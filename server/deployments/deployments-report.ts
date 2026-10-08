import type { DeploymentMark, DeploymentReader } from '../github/deployment-reader.ts';
import { isNotFound } from '../github/rest-json.ts';
import { isBuilding, withStatuses } from './deployment-view.ts';
import type { DeploymentsReport, EnvironmentView, PullPreview } from './deployments-types.ts';

/** Where the PR screen asks what a pull request's head was deployed as. */
export const PREVIEW_PATH = '/api/deployments/preview';

/** Each environment's latest deployment and the ones before it: a status request apiece. */
export const HISTORY_LENGTH = 8;
/** Enough of the newest deployments to name every environment in use. */
const NAMING_LIMIT = 100;
/** Enough to find a commit's deployment to each environment, redeploys included. */
const PREVIEW_LIMIT = 20;
const PRODUCTION = /prod/i;

/**
 * The environments' names. Where GitHub keeps no environments for the
 * repository, the names its newest deployments were made to.
 */
async function environmentNames(github: DeploymentReader, repo: string): Promise<string[]> {
  const named = await github.environments(repo).catch((error: unknown) => {
    if (isNotFound(error)) return [];
    throw error;
  });
  if (named.length) return named;
  const recent = await github.deployments(repo, { limit: NAMING_LIMIT });
  return [...new Set(recent.map((deployment) => deployment.environment))];
}

async function environmentOf(
  github: DeploymentReader,
  repo: string,
  name: string,
): Promise<EnvironmentView> {
  const marks = await github.deployments(repo, { environment: name, limit: HISTORY_LENGTH });
  return {
    name,
    isProduction: PRODUCTION.test(name),
    url: `https://github.com/${repo}/deployments/activity_log?environments_filter=${encodeURIComponent(name)}`,
    deployments: await withStatuses(github, repo, marks),
  };
}

const latestTime = (environment: EnvironmentView): number => {
  const [latest] = environment.deployments;
  return latest ? Date.parse(latest.createdAt) : 0;
};

/** Production first, then the most recently deployed, then by name. */
export const byProminence = (a: EnvironmentView, b: EnvironmentView): number =>
  Number(b.isProduction) - Number(a.isProduction) ||
  latestTime(b) - latestTime(a) ||
  a.name.localeCompare(b.name);

/** The Deployments screen's report: each environment with its latest deployments and how they went. */
export async function deploymentsReport(
  github: DeploymentReader,
  repo: string,
  now: number = Date.now(),
): Promise<DeploymentsReport> {
  const names = await environmentNames(github, repo);
  const environments = await Promise.all(names.map((name) => environmentOf(github, repo, name)));
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    environments: [...environments].sort(byProminence),
  };
}

/** A deployment is still building somewhere, so the report is worth reading again soon. */
export const isReportBuilding = (report: DeploymentsReport): boolean =>
  report.environments.some((environment) => environment.deployments[0]?.outcome === 'building');

/** What one commit, a pull request's head, was deployed as: the newest to each environment. */
export async function pullPreview(
  github: DeploymentReader,
  repo: string,
  sha: string,
): Promise<PullPreview> {
  const marks = await github.deployments(repo, { sha, limit: PREVIEW_LIMIT });
  const newestEach = new Map<string, DeploymentMark>();
  for (const mark of marks)
    if (!newestEach.has(mark.environment)) newestEach.set(mark.environment, mark);
  return { repo, sha, deployments: await withStatuses(github, repo, [...newestEach.values()]) };
}

/** Nothing deployed yet, or still building: worth asking again soon. */
export const isPreviewUnsettled = (preview: PullPreview): boolean =>
  !preview.deployments.length || isBuilding(preview.deployments);
