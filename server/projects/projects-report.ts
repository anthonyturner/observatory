import type { GitHubReader, PullRequest, RepoRef } from '../github/github-reader.ts';
import { mapWithLimit } from '../util/map-with-limit.ts';
import { topDirectives } from './directives.ts';
import type { Directive, ProjectSnapshot, ProjectsReport } from './project-types.ts';
import { bucketOf, oldestIdleDays, pullCounts } from './pull-counts.ts';
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

/** One repository as read: its snapshot, and its pull requests as candidates
 *  for the directives. */
interface ProjectRead {
  readonly snapshot: ProjectSnapshot;
  readonly candidates: readonly Directive[];
}

/** The star map a project will have; until then the route leads Home. */
const dashboardUrlOf = (nameWithOwner: string): string => `/p/${nameWithOwner}`;

const firstLine = (error: unknown): string =>
  String((error as { message?: string })?.message ?? error)
    .split('\n')[0]
    .slice(0, MAX_ERROR_LENGTH);

const directiveOf = (project: string, pull: PullRequest): Directive => ({
  project,
  number: pull.number,
  title: pull.title,
  url: pull.url,
  bucket: bucketOf(pull),
  updatedAt: pull.updatedAt,
});

async function readProject(
  github: GitHubReader,
  repo: RepoRef,
  now: number,
  wait?: Sleep,
): Promise<ProjectRead> {
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
      snapshot: {
        ...base,
        open: pulls.length,
        counts: pullCounts(pulls, openIssues),
        ...(openIssues ? { issues: openIssues.length } : {}),
        oldestIdleDays: oldestIdleDays(pulls, now),
      },
      candidates: pulls.map((pull) => directiveOf(repo.name, pull)),
    };
  } catch (error) {
    // Unreadable is its own state, never quietly zero.
    return {
      snapshot: { ...base, open: 0, counts: NO_COUNTS, error: firstLine(error) },
      candidates: [],
    };
  }
}

/** Every repository the signed-in account owns, as a project snapshot, and
 *  the most urgent pull requests across them. */
export async function projectsReport(
  github: GitHubReader,
  now = Date.now(),
  wait?: Sleep,
): Promise<ProjectsReport> {
  const repos = await github.ownedRepos(await github.viewer());
  const reads = await mapWithLimit(repos, CONCURRENT_REPOS, (repo) =>
    readProject(github, repo, now, wait),
  );
  return {
    generatedAt: new Date(now).toISOString(),
    projects: reads.map((read) => read.snapshot),
    directives: topDirectives(reads.flatMap((read) => read.candidates)),
  };
}
