import { ProjectSnapshot } from '../../../core/projects/project.types';
import { IDLE_CHIP, WORKING_CHIP, chipOf } from '../../../core/core-state/core-chips';
import { coreStatusOf, homeSummaryFrom } from './home-summary';

const NOW = new Date(2026, 8, 26, 15, 0).getTime();
const quiet = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, open: number, failing = 0): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open,
  counts: { ...quiet, failing },
});
const ready = (projects: ProjectSnapshot[], generatedAt: Date) =>
  ({
    status: 'ready',
    report: { generatedAt: generatedAt.toISOString(), projects, directives: [] },
  }) as const;

describe('homeSummaryFrom', () => {
  it('counts blocked projects, projects and open pull requests, refreshed today', () => {
    const summary = homeSummaryFrom(
      ready([project('a', 5, 2), project('b', 3), project('c', 0)], new Date(2026, 8, 26, 9, 42)),
      NOW,
    );

    expect(summary.stamp).toBe('1 blocked · 3 projects · 8 open · refreshed 09:42');
    expect(summary.statuses.map((status) => status.label)).toEqual(['Local', '3 projects tracked']);
  });

  it('dates a read from another day', () => {
    const summary = homeSummaryFrom(
      ready([project('a', 1)], new Date(2026, 8, 25, 23, 5)),
      NOW,
      'en-GB',
    );

    expect(summary.stamp).toBe('0 blocked · 1 project · 1 open · refreshed 25 Sept 23:05');
  });

  it('says it is reading, or out of reach, instead of counting', () => {
    expect(homeSummaryFrom({ status: 'reading' }, NOW).stamp).toBe('reading the projects');

    const unreachable = homeSummaryFrom({ status: 'unreachable' }, NOW);
    expect(unreachable.stamp).toBe('API out of reach');
    expect(unreachable.statuses[1]).toEqual({ label: 'Projects · out of reach', state: 'error' });
  });
});

describe('coreStatusOf', () => {
  it('names the lit chip, with a quiet dot at rest, a red one on an error, else a live one', () => {
    expect(coreStatusOf(IDLE_CHIP)).toEqual({ label: 'Core · Idle', state: 'idle' });
    expect(coreStatusOf(WORKING_CHIP)).toEqual({ label: 'Core · Working', state: 'active' });
    expect(coreStatusOf(chipOf('error'))).toEqual({ label: 'Core · Error', state: 'error' });
  });
});
