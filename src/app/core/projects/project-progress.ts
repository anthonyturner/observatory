import { ProjectSnapshot } from './project.types';

/** What one project got done between two reports. */
export interface ProjectProgress {
  readonly key: string;
  readonly closedIssues: number;
  /** Pull requests that left the open list: merged, most often. */
  readonly finishedPulls: number;
}

/** The projects with fewer open issues or pull requests than before. A project
 *  GitHub could not read, in either report, is left out: its counts say nothing. */
export function progressBetween(
  before: readonly ProjectSnapshot[],
  after: readonly ProjectSnapshot[],
): ProjectProgress[] {
  const earlier = new Map(
    before.filter((project) => !project.error).map((project) => [project.repo, project]),
  );
  return after
    .filter((project) => !project.error)
    .map((project): ProjectProgress | null => {
      const was = earlier.get(project.repo);
      if (!was) return null;
      const closedIssues = Math.max(0, (was.issues ?? 0) - (project.issues ?? was.issues ?? 0));
      const finishedPulls = Math.max(0, was.open - project.open);
      return closedIssues + finishedPulls > 0
        ? { key: project.repo, closedIssues, finishedPulls }
        : null;
    })
    .filter((progress): progress is ProjectProgress => progress !== null);
}
