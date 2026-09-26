import { ProjectSnapshot } from '../../../core/projects/project.types';
import { openIssuesVital } from './issues-vital';

const NOW = Date.parse('2026-09-26T12:05:00Z');
const quiet = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (name: string, extra: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  name,
  repo: `me/${name}`,
  dashboardUrl: `/p/me/${name}`,
  open: 0,
  counts: quiet,
  ...extra,
});
const ready = (projects: ProjectSnapshot[]) =>
  ({ status: 'ready', report: { generatedAt: '2026-09-26T12:00:00Z', projects } }) as const;

describe('openIssuesVital', () => {
  it('adds up open issues across the projects it could read', () => {
    const vital = openIssuesVital(
      ready([project('a', { issues: 4 }), project('b', { issues: 3 })]),
      NOW,
    );

    expect(vital).toMatchObject({ value: '7', age: '5m', note: 'across 2 projects' });
    expect(vital.unit).toBeUndefined();
  });

  it('marks the total as a floor when a project could not be read', () => {
    const vital = openIssuesVital(
      ready([project('a', { issues: 4 }), project('b', { error: 'rate limited' })]),
      NOW,
    );

    expect(vital).toMatchObject({ value: '4', unit: '+?', note: '1 not read' });
  });

  it('says unknown when nothing could be read', () => {
    expect(openIssuesVital(ready([project('a', { error: 'down' })]), NOW)).toMatchObject({
      value: null,
      note: 'not read',
    });
    expect(openIssuesVital({ status: 'unreachable' }, NOW)).toMatchObject({
      value: null,
      note: 'API out of reach',
    });
  });
});
