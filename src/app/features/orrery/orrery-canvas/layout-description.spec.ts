import { ProjectCounts, ProjectSnapshot } from '../../../core/projects/project.types';
import { layoutWorlds } from '../../../core/orrery/world-layout';
import { describeLayout } from './layout-description';

const quiet: ProjectCounts = {
  conflicted: 0,
  failing: 0,
  unknown: 0,
  unlinked: 0,
  unreviewed: 0,
  unclaimed: 0,
};
const project = (name: string, open: number): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: '',
  open,
  counts: quiet,
});

describe('describeLayout', () => {
  it('names the sun’s total', () => {
    expect(describeLayout(layoutWorlds([project('a', 3), project('b', 4)]))).toBe(
      'Earth at the centre; the sun, with 7 open pull requests, at the upper left',
    );
  });

  it('says "1 open pull request" in the singular', () => {
    expect(describeLayout(layoutWorlds([project('a', 1)]))).toContain('1 open pull request,');
  });

  it('gives no total before there are worlds to count', () => {
    expect(describeLayout([])).toBe('Earth at the centre; the sun at the upper left');
  });
});
