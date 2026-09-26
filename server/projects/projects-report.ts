import type { GitHubReader, RepoRef } from '../github/github-reader.ts';
import { mapWithLimit } from '../util/map-with-limit.ts';
import type { ProjectSnapshot, ProjectsReport } from './project-types.ts';
import { oldestIdleDays, pullCounts } from './pull-counts.ts';
import { settleMergeable, type Sleep } from './settle-mergeable.ts';

/** Repositories read at once: quick, without tripping GitHub's abuse limits. */
const CONCURRENT_REPOS = 4;
/** Long enough to say why, short enough for a card. */
const MAX_ERROR_LENGTH = 200;

const NO_COUNTS = {
  conflicted: 0,
  failing: 0,
  unknown: 0,
  unlinked: 0,
  unreviewed: 0,
  unclaimed: 0,
};

/** The star map a project will have; until then the route leads Home. */
const dashboardUrlOf = (nameWithOwner: string): string => `/p/${nameWithOwner}`;

const firstLine = (error: unknown): string =>
  String((error as { message?: string })?.message ?? error)
    .split('\n')[0]
    .slice(0, MAX_ERROR_LENGTH);

async function snapshotOf(
  github: GitHubReader,
  repo: RepoRef,
  now: number,
  wait?: Sleep,
): Promise<ProjectSnapshot> {
  const base = {
    name: repo.name,
    repo: repo.nameWithOwner,
    dashboardUrl: dashboardUrlOf(repo.nameWithOwner),
  };
  try {
    const [listed, openIssues] = await Promise.all([
      github.openPulls(repo.nameWithOwner),
      github.openIssueNumbers(repo.nameWithOwner),
    ]);
    const pulls = await settleMergeable(github, repo.nameWithOwner, listed, wait);
    return {
      ...base,
      open: pulls.length,
      counts: pullCounts(pulls, openIssues),
      ...(openIssues ? { issues: openIssues.length } : {}),
      oldestIdleDays: oldestIdleDays(pulls, now),
    };
  } catch (error) {
    // Unreadable is its own state, never quietly zero.
    return { ...base, open: 0, counts: NO_COUNTS, error: firstLine(error) };
  }
}

/** Every repository the signed-in account owns, as a project snapshot. */
export async function projectsReport(
  github: GitHubReader,
  now = Date.now(),
  wait?: Sleep,
): Promise<ProjectsReport> {
  const repos = await github.ownedRepos(await github.viewer());
  const projects = await mapWithLimit(repos, CONCURRENT_REPOS, (repo) =>
    snapshotOf(github, repo, now, wait),
  );
  return { generatedAt: new Date(now).toISOString(), projects };
}
