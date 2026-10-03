import { ProjectSnapshot } from '../projects/project.types';
import { ProjectsReport } from '../projects/projects-report';
import { Sighting } from './activity.types';

/** One repository as the last compared report showed it. */
interface RepoMemory {
  /** Its open pull requests; null until a report lists them. */
  readonly pulls: ReadonlySet<number> | null;
  /** The highest issue or pull request number seen, which share one sequence on
   *  GitHub; null until a report lists its issues. */
  readonly highestNumber: number | null;
}

/** What the watcher remembers between reports. */
export interface ActivityMemory {
  /** When the last compared report was made, in epoch milliseconds. */
  readonly comparedAt: number | null;
  readonly repos: ReadonlyMap<string, RepoMemory>;
}

/** What one report changed, and the memory to compare the next one with. */
export interface Comparison {
  readonly memory: ActivityMemory;
  /** Pull requests that were open and are not now: merged or closed, not yet known which. */
  readonly departedPulls: readonly Sighting[];
  readonly newIssues: readonly Sighting[];
}

export const EMPTY_MEMORY: ActivityMemory = { comparedAt: null, repos: new Map() };

const UNSEEN: RepoMemory = { pulls: null, highestNumber: null };

/**
 * Compares a report with the memory of the last one. A repository seen for the
 * first time, an unreadable project and an unknown list only set or keep the
 * memory; a report no newer than the last compared changes nothing.
 */
export function compareReport(memory: ActivityMemory, report: ProjectsReport): Comparison {
  const madeAt = Date.parse(report.generatedAt);
  if (!isNewer(madeAt, memory.comparedAt)) return { memory, departedPulls: [], newIssues: [] };
  const labels = labelsOf(report.projects);
  const repos = new Map(memory.repos);
  const departedPulls: Sighting[] = [];
  const newIssues: Sighting[] = [];
  for (const project of report.projects) {
    if (project.error !== undefined) continue;
    const before = memory.repos.get(project.repo) ?? UNSEEN;
    const sighting = (number: number): Sighting => ({
      repo: project.repo,
      label: labels.get(project.repo) ?? project.name,
      number,
    });
    departedPulls.push(...pullsGone(before, project).map(sighting));
    newIssues.push(...issuesOpened(before, project).map(sighting));
    repos.set(project.repo, remember(before, project));
  }
  return { memory: { comparedAt: madeAt, repos }, departedPulls, newIssues };
}

const isNewer = (madeAt: number, comparedAt: number | null): boolean =>
  !Number.isNaN(madeAt) && (comparedAt === null || madeAt > comparedAt);

/** Each project's display name, or its `owner/repo` where two share a name. */
function labelsOf(projects: readonly ProjectSnapshot[]): Map<string, string> {
  const named = new Map<string, number>();
  for (const { name } of projects) named.set(name, (named.get(name) ?? 0) + 1);
  return new Map(
    projects.map(({ name, repo }) => [repo, (named.get(name) ?? 0) > 1 ? repo : name]),
  );
}

function pullsGone(before: RepoMemory, project: ProjectSnapshot): number[] {
  const { pulls } = before;
  if (!pulls || !project.openPulls) return [];
  const open = new Set(project.openPulls);
  return [...pulls].filter((number) => !open.has(number)).sort(ascending);
}

/** Higher than any number seen before, so a reopened issue seen open this session
 *  never counts as new. One closed before the page loaded, numbered above every
 *  issue and pull request open then, still would: the report holds nothing older. */
function issuesOpened(before: RepoMemory, project: ProjectSnapshot): number[] {
  const { highestNumber } = before;
  if (highestNumber === null || !project.openIssues) return [];
  return project.openIssues.filter((number) => number > highestNumber).sort(ascending);
}

function remember(before: RepoMemory, project: ProjectSnapshot): RepoMemory {
  const { openPulls, openIssues } = project;
  return {
    pulls: openPulls ? new Set(openPulls) : before.pulls,
    highestNumber: openIssues
      ? Math.max(before.highestNumber ?? 0, ...openIssues, ...(openPulls ?? []))
      : before.highestNumber,
  };
}

const ascending = (a: number, b: number): number => a - b;
