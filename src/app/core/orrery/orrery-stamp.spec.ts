import { ProjectSnapshot } from '../projects/project.types';
import { orreryStamp } from './orrery-stamp';

const NOW = new Date(2026, 8, 26, 15, 0).getTime();
const quiet = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, open: number): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open,
  counts: quiet,
});
const ready = (projects: ProjectSnapshot[], at: Date) =>
  ({
    status: 'ready',
    report: { generatedAt: at.toISOString(), projects, directives: [] },
  }) as const;

describe('orreryStamp', () => {
  it('counts worlds and open pull requests, refreshed today', () => {
    expect(
      orreryStamp(ready([project('a', 3), project('b', 4)], new Date(2026, 8, 26, 9, 5)), NOW),
    ).toBe('2 worlds · 7 open · refreshed 09:05');
  });

  it('dates a read from another day', () => {
    expect(orreryStamp(ready([project('a', 1)], new Date(2026, 8, 24, 8, 0)), NOW, 'en-GB')).toBe(
      '1 world · 1 open · refreshed 24 Sept 08:00',
    );
  });

  it('says it is reading, or out of reach', () => {
    expect(orreryStamp({ status: 'reading' }, NOW)).toBe('reading the projects');
    expect(orreryStamp({ status: 'unreachable' }, NOW)).toBe('API out of reach');
  });
});
