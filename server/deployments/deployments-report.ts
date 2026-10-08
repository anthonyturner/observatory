import type { DeploymentMark, DeploymentReader } from '../github/deployment-reader.ts';
import { isNotFound } from '../github/rest-json.ts';
import { isBuilding, withStatuses } from './deployment-view.ts';
import type { DeploymentsReport, EnvironmentView, PullPreview } from './deployments-types.ts';

/** Where the PR screen asks what a pull request's head was deployed as. */
export const PREVIEW_PATH = '/api/deployments/preview';

/** Each environment's latest deployment and the ones before it: a status request apiece. */
export const HISTORY_LENGTH = 8;
/** Enough of the newest deployments to name every environment in use, and in which order. */
const NAMING_LIMIT = 100;
/**
 * Each environment read costs a request and one more per deployment in its
 * history. A deployer that makes an environment per pull request, such as
 * review apps, can list a hundred, so past this many only the first are read.
 */
export const ENVIRONMENT_LIMIT = 6;
/** Enough to find a commit's deployment to each environment, redeploys included. */
const PREVIEW_LIMIT = 20;
const PRODUCTION = /prod/i;

const isProductionName = (name: string): boolean => PRODUCTION.test(name);

/**
 * Every environment's name: production first, then the ones the newest
 * deployments went to, most recent first, then any others GitHub keeps for
 * the repository. Where it keeps none, the deployments' names are all there are.
 */
async function environmentNames(github: DeploymentReader, repo: string): Promise<string[]> {
  const [recent, configured] = await Promise.all([
    github.deployments(repo, { limit: NAMING_LIMIT }),
    github.environments(repo).catch((error: unknown) => {
      if (isNotFound(error)) return [];
      throw error;
    }),
  ]);
  const names = [...new Set([...recent.map((each) => each.environment), ...configured])];
  return names.sort((a, b) => Number(isProductionName(b)) - Number(isProductionName(a)));
}

async function environmentOf(
  github: DeploymentReader,
  repo: string,
  name: string,
): Promise<EnvironmentView> {
  const marks = await github.deployments(repo, { environment: name, limit: HISTORY_LENGTH });
  return {
    name,
    isProduction: isProductionName(name),
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
  const environments = await Promise.all(
    names.slice(0, ENVIRONMENT_LIMIT).map((name) => environmentOf(github, repo, name)),
  );
  return {
    generatedAt: new Date(now).toISOString(),
    repo,
    environments: [...environments].sort(byProminence),
    environmentCount: names.length,
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
  for (const mark of marks) {
    if (!newestEach.has(mark.environment)) newestEach.set(mark.environment, mark);
  }
  return { repo, sha, deployments: await withStatuses(github, repo, [...newestEach.values()]) };
}

/** Nothing deployed yet, or still building: worth asking again soon. */
export const isPreviewUnsettled = (preview: PullPreview): boolean =>
  !preview.deployments.length || isBuilding(preview.deployments);
