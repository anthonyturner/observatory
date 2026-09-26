import { ProjectSnapshot } from './project.types';

/** Open issues across the projects GitHub could read, or null when none
 *  could be. Unreadable projects are left out, so this is a floor. */
export function knownOpenIssues(projects: readonly ProjectSnapshot[]): number | null {
  const known = projects.filter((project) => !project.error && project.issues !== undefined);
  if (!known.length) return null;
  return known.reduce((sum, project) => sum + (project.issues ?? 0), 0);
}
