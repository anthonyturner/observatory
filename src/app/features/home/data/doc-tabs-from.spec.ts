import { ProjectSnapshot } from '../../../core/projects/project.types';
import { docTabsFrom } from './doc-tabs-from';

const quiet = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, conflicted = 0): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: conflicted,
  counts: { ...quiet, conflicted },
});

describe('docTabsFrom', () => {
  it('opens the project first in the blocked-first queue', () => {
    const tabs = docTabsFrom([project('calm'), project('stuck', 3)]);

    expect(tabs).toEqual({
      project: 'stuck',
      links: [
        { label: 'Star map', href: '/p/me/stuck' },
        { label: 'Orrery', href: '/orrery' },
        { label: 'Issues', href: '/p/me/stuck#issues' },
        { label: 'Logs', href: '/p/me/stuck#logs' },
        { label: 'Usage', href: '/p/me/stuck#usage' },
      ],
    });
  });

  it('keeps only the orrery when there are no projects', () => {
    expect(docTabsFrom([])).toEqual({ links: [{ label: 'Orrery', href: '/orrery' }] });
  });
});
