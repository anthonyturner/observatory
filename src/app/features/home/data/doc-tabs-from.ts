import { ProjectSnapshot } from '../../../core/projects/project.types';
import { compareProjects } from '../../../core/projects/severity';
import { DocLink, DocTabs } from './vitals';

const ORRERY: DocLink = { label: 'Orrery', path: '/orrery' };

/** The parts of a project's star map a tab opens, after the map itself. */
const STAR_MAP_PARTS: readonly { readonly label: string; readonly fragment: string }[] = [
  { label: 'Issues', fragment: 'issues' },
  { label: 'Logs', fragment: 'logs' },
  { label: 'Usage', fragment: 'usage' },
];

/** The other views. A star map's tabs open the project first in the
 *  blocked-first queue; the orrery is always there. */
export function docTabsFrom(projects: readonly ProjectSnapshot[]): DocTabs {
  const [first] = [...projects].sort(compareProjects);
  if (!first) return { links: [ORRERY] };
  return {
    project: first.name,
    links: [
      { label: 'Star map', path: first.dashboardUrl },
      ORRERY,
      ...STAR_MAP_PARTS.map(({ label, fragment }) => ({
        label,
        path: first.dashboardUrl,
        fragment,
      })),
    ],
  };
}
