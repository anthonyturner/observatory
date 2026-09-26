import type { ProjectsReport } from '../projects/project-types.ts';
import type { Project } from './route-contract.ts';

/** The projects a request can name: those with a star map. */
export const projectsOf = (report: ProjectsReport): Project[] =>
  report.projects
    .filter((each) => each.name && each.dashboardUrl)
    .map((each) => ({ name: each.name, repo: each.repo, href: each.dashboardUrl }));
