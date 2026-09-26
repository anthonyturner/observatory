import { ProjectSnapshot } from '../../../core/projects/project.types';
import { compareProjects } from '../../../core/projects/severity';
import { DocLink, DocTabs } from './vitals';

const ORRERY: DocLink = { label: 'Orrery', href: '/orrery' };

/** The parts of a project's star map a tab opens, after the map itself. */
const STAR_MAP_PARTS: readonly { readonly label: string; readonly hash: string }[] = [
  { label: 'Issues', hash: '#issues' },
  { label: 'Logs', hash: '#logs' },
  { label: 'Usage', hash: '#usage' },
];

/** The other views. A star map's tabs open the project first in the
 *  blocked-first queue; the orrery is always there. */
export function docTabsFrom(projects: readonly ProjectSnapshot[]): DocTabs {
  const [first] = [...projects].sort(compareProjects);
  if (!first) return { links: [ORRERY] };
  return {
    project: first.name,
    links: [
      { label: 'Star map', href: first.dashboardUrl },
      ORRERY,
      ...STAR_MAP_PARTS.map(({ label, hash }) => ({ label, href: first.dashboardUrl + hash })),
    ],
  };
}
