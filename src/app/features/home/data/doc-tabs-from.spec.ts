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
        { label: 'Star map', path: '/p/me/stuck' },
        { label: 'Orrery', path: '/orrery' },
        { label: 'Issues', path: '/p/me/stuck', fragment: 'issues' },
        { label: 'Logs', path: '/p/me/stuck', fragment: 'logs' },
        { label: 'Usage', path: '/p/me/stuck', fragment: 'usage' },
      ],
    });
  });

  it('keeps only the orrery when there are no projects', () => {
    expect(docTabsFrom([])).toEqual({ links: [{ label: 'Orrery', path: '/orrery' }] });
  });
});
