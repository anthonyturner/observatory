import type { DeploymentReader } from '../github/deployment-reader.ts';
import { mapWithLimit } from '../util/map-with-limit.ts';
import { environmentNames, isProductionName } from './deployments-report.ts';
import { withStatuses } from './deployment-view.ts';
import type { LiveSite, LiveSitesReport } from './deployments-types.ts';

/** Where the Run button asks for every project's production site at once. */
export const LIVE_SITES_PATH = '/api/live-sites';

/**
 * How many of production's newest deployments are looked at for one that is
 * live. The newest may be building or have failed, so the one before it is the
 * site; past a few, a project has no live production site worth linking.
 */
export const LIVE_SITE_SCAN = 5;
/** Repositories read at once: quick, without tripping GitHub's abuse limits. */
const CONCURRENT_REPOS = 4;

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }): number =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt);

/**
 * The address of a repository's production site: the newest production
 * deployment that went live and says where. Previews, and production
 * deployments that are building or failed, are passed over. Null when there is none.
 */
export async function liveSiteUrl(github: DeploymentReader, repo: string): Promise<string | null> {
  const production = (await environmentNames(github, repo)).filter(isProductionName);
  const marks = (
    await Promise.all(
      production.map((name) => github.deployments(repo, { environment: name, limit: LIVE_SITE_SCAN })),
    )
  )
    .flat()
    .sort(newestFirst)
    .slice(0, LIVE_SITE_SCAN);
  // One at a time: the newest is nearly always the answer, so the rest are not asked about.
  for (const mark of marks) {
    const [view] = await withStatuses(github, repo, [mark]);
    if (view.outcome === 'ready' && view.url) return view.url;
  }
  return null;
}

/** A repository GitHub will not answer for has no link this time, and no other repository loses its own. */
async function siteOf(github: DeploymentReader, repo: string): Promise<LiveSite | null> {
  try {
    const url = await liveSiteUrl(github, repo);
    return url ? { repo, url } : null;
  } catch (error: unknown) {
    console.error(`Could not read ${repo}'s production site:`, error);
    return null;
  }
}

/** The production site of each of `repos` that has one, read a few repositories at a time. */
export async function liveSitesReport(
  github: DeploymentReader,
  repos: readonly string[],
  now: number = Date.now(),
): Promise<LiveSitesReport> {
  const sites = await mapWithLimit(repos, CONCURRENT_REPOS, (repo) => siteOf(github, repo));
  return {
    generatedAt: new Date(now).toISOString(),
    sites: sites.filter((site) => site !== null),
  };
}
