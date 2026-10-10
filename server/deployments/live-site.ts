import type { DeploymentReader } from '../github/deployment-reader.ts';
import type { RepoRef } from '../github/github-reader.ts';
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
/** A homepage is a link for people, so only a web page is kept as one. */
const WEB_LINK = /^https?:\/\//i;

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
      production.map((name) =>
        github.deployments(repo, { environment: name, limit: LIVE_SITE_SCAN }),
      ),
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

/** A site moves rarely, and finding every project's can cost a few requests apiece. */
export const LIVE_SITES_TTL_MS = 30 * 60_000;
/** A repository GitHub would not answer for is asked about again soon. */
export const LIVE_SITES_RETRY_MS = 2 * 60_000;

/** How long a report is kept: briefly when any repository could not be read. */
export const liveSitesLifetime = (report: LiveSitesReport): number =>
  report.unreadCount ? LIVE_SITES_RETRY_MS : LIVE_SITES_TTL_MS;

/** What a repository's site is looked up from: its name and the homepage its owner set. */
export type SiteCandidate = Pick<RepoRef, 'nameWithOwner' | 'homepageUrl'>;

/** The owner's own address for the site, when it is a web page: the one that is safe to link to. */
function homepageOf(repo: SiteCandidate): string | null {
  const homepage = repo.homepageUrl?.trim();
  return homepage && WEB_LINK.test(homepage) ? homepage : null;
}

/**
 * The site to link for one repository: the owner's homepage, which is the address
 * made to be visited, else its production deployment's. A deployment's own
 * address can sit behind the host's sign-in, so it is only a fallback, and a
 * repository with a homepage costs no deployment requests.
 */
async function siteOf(github: DeploymentReader, repo: SiteCandidate): Promise<LiveSite | null> {
  const homepage = homepageOf(repo);
  if (homepage) return { repo: repo.nameWithOwner, url: homepage };
  const url = await liveSiteUrl(github, repo.nameWithOwner);
  return url ? { repo: repo.nameWithOwner, url } : null;
}

/**
 * The site of each of `repos` that has one, a few repositories at a time. A
 * repository GitHub will not answer for has no link this time and is counted in
 * `unreadCount`; no other repository loses its own.
 */
export async function liveSitesReport(
  github: DeploymentReader,
  repos: readonly SiteCandidate[],
  now: number = Date.now(),
): Promise<LiveSitesReport> {
  const reads = await mapWithLimit(repos, CONCURRENT_REPOS, async (repo) => {
    try {
      return { site: await siteOf(github, repo), isRead: true };
    } catch (error: unknown) {
      console.error(`Could not read ${repo.nameWithOwner}'s production site:`, error);
      return { site: null, isRead: false };
    }
  });
  return {
    generatedAt: new Date(now).toISOString(),
    sites: reads.flatMap((read) => (read.site ? [read.site] : [])),
    unreadCount: reads.filter((read) => !read.isRead).length,
  };
}
