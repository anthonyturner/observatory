import { OpenItem, hrefOf } from '../../../core/assistant/open-items';
import { ProjectSnapshot } from '../../../core/projects/project.types';
import { ProjectsState } from '../../../core/projects/projects-feed';
import { NamedProject } from './queue-command';

/** The projects GitHub could read, or null until they are read. */
export const readProjectsOf = (state: ProjectsState): readonly ProjectSnapshot[] | null =>
  state.status === 'ready' ? state.report.projects.filter((each) => !each.error) : null;

/** Pull request `number` as Jev's open question lists it, to open or send a crew to;
 *  an unknown title is empty. */
export const pullItemOf = (
  project: NamedProject,
  number: number,
  title: string | null,
): OpenItem => ({
  kind: 'pull',
  repo: project.repo,
  label: project.name,
  number,
  title: title ?? '',
  href: hrefOf('pull', project.repo, number),
});
