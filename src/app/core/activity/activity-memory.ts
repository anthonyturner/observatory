import { ListedPull, ProjectSnapshot } from '../projects/project.types';
import { ProjectsReport } from '../projects/projects-report';
import { Sighting } from './activity.types';

/** One repository as the last compared report showed it. */
interface RepoMemory {
  /** Its open pull requests, each with the issues it says it closes; null until
   *  a report lists them. */
  readonly pulls: ReadonlyMap<number, readonly number[]> | null;
  /** Its open issues; null until a report lists them. */
  readonly issues: ReadonlySet<number> | null;
  /** The highest issue or pull request number seen, which share one sequence on
   *  GitHub; null until a report lists either. */
  readonly highestNumber: number | null;
}

/** What the watcher remembers between reports. */
export interface ActivityMemory {
  /** When the last compared report was made, in epoch milliseconds. */
  readonly comparedAt: number | null;
  readonly repos: ReadonlyMap<string, RepoMemory>;
}

/** A pull request that was open and is not now: merged or closed, not yet known which. */
export interface DepartedPull extends Sighting {
  /** The issues it said it closes while it was open. */
  readonly closes: readonly number[];
}

export interface OpenedPull extends Sighting {
  readonly title: string | null;
}

/** What one report changed, and the memory to compare the next one with. */
export interface Comparison {
  readonly memory: ActivityMemory;
  readonly departedPulls: readonly DepartedPull[];
  readonly openedPulls: readonly OpenedPull[];
  readonly newIssues: readonly Sighting[];
  /** Issues that were open and are not now: closed, transferred or gone, not yet known which. */
  readonly departedIssues: readonly Sighting[];
}

interface Changes {
  departedPulls: DepartedPull[];
  openedPulls: OpenedPull[];
  newIssues: Sighting[];
  departedIssues: Sighting[];
}

export const EMPTY_MEMORY: ActivityMemory = { comparedAt: null, repos: new Map() };

const UNSEEN: RepoMemory = { pulls: null, issues: null, highestNumber: null };

const noChanges = (): Changes => ({
  departedPulls: [],
  openedPulls: [],
  newIssues: [],
  departedIssues: [],
});

/**
 * Compares a report with the memory of the last one. A repository seen for the
 * first time, an unreadable project and an unknown list only set or keep the
 * memory; a report no newer than the last compared changes nothing.
 */
export function compareReport(memory: ActivityMemory, report: ProjectsReport): Comparison {
  const madeAt = Date.parse(report.generatedAt);
  if (!isNewer(madeAt, memory.comparedAt)) return { memory, ...noChanges() };
  const labels = labelsOf(report.projects);
  const repos = new Map(memory.repos);
  const changes = noChanges();
  for (const project of report.projects) {
    if (project.error !== undefined) continue;
    const before = memory.repos.get(project.repo) ?? UNSEEN;
    const label = labels.get(project.repo) ?? project.name;
    const sighting = (number: number): Sighting => ({ repo: project.repo, label, number });
    changes.departedPulls.push(
      ...pullsGone(before, project).map(([number, closes]) => ({ ...sighting(number), closes })),
    );
    changes.openedPulls.push(
      ...pullsOpened(before, project).map(({ number, title }) => ({ ...sighting(number), title })),
    );
    changes.newIssues.push(...issuesOpened(before, project).map(sighting));
    changes.departedIssues.push(...issuesGone(before, project).map(sighting));
    repos.set(project.repo, remember(before, project));
  }
  return { memory: { comparedAt: madeAt, repos }, ...changes };
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

function pullsGone(before: RepoMemory, project: ProjectSnapshot): [number, readonly number[]][] {
  const { pulls } = before;
  if (!pulls || !project.openPulls) return [];
  const open = new Set(project.openPulls.map(({ number }) => number));
  return [...pulls].filter(([number]) => !open.has(number)).sort(([a], [b]) => a - b);
}

function issuesGone(before: RepoMemory, project: ProjectSnapshot): number[] {
  const { issues } = before;
  if (!issues || !project.openIssues) return [];
  const open = new Set(project.openIssues);
  return [...issues].filter((number) => !open.has(number)).sort(ascending);
}

/** Higher than any number seen before, so one reopened this session never
 *  counts. One closed before the page loaded, numbered above every issue and
 *  pull request open then, still would: the report holds nothing older. */
const isNew = (before: RepoMemory, number: number): boolean =>
  before.highestNumber !== null && number > before.highestNumber;

function pullsOpened(before: RepoMemory, project: ProjectSnapshot): ListedPull[] {
  if (!before.pulls || !project.openPulls) return [];
  return project.openPulls
    .filter(({ number }) => isNew(before, number))
    .sort((a, b) => a.number - b.number);
}

function issuesOpened(before: RepoMemory, project: ProjectSnapshot): number[] {
  if (!before.issues || !project.openIssues) return [];
  return project.openIssues.filter((number) => isNew(before, number)).sort(ascending);
}

function remember(before: RepoMemory, project: ProjectSnapshot): RepoMemory {
  const { openPulls, openIssues } = project;
  const pullNumbers = openPulls?.map(({ number }) => number) ?? [];
  const isListed = openPulls !== undefined || openIssues !== undefined;
  return {
    pulls: openPulls
      ? new Map(openPulls.map(({ number, closes }) => [number, closes]))
      : before.pulls,
    issues: openIssues ? new Set(openIssues) : before.issues,
    highestNumber: isListed
      ? Math.max(before.highestNumber ?? 0, ...(openIssues ?? []), ...pullNumbers)
      : before.highestNumber,
  };
}

const ascending = (a: number, b: number): number => a - b;
