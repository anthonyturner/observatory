import { ProjectSnapshot } from '../projects/project.types';
import { nightSide } from './world-night';

const project = (open: number, oldestIdleDays: number, failing: number): ProjectSnapshot => ({
  name: 'p',
  repo: 'o/p',
  dashboardUrl: '',
  open,
  oldestIdleDays,
  counts: { conflicted: 0, failing, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 },
});

describe('nightSide', () => {
  it('is dark and calm with nothing open and nothing failing', () => {
    expect(nightSide(project(0, 0, 0))).toEqual({ lights: 0, unrest: 0 });
  });

  it('lights up with open work and dims as the oldest pull request goes stale', () => {
    expect(nightSide(project(5, 0, 0)).lights).toBeCloseTo(0.5);
    expect(nightSide(project(20, 0, 0)).lights).toBe(1);
    expect(nightSide(project(20, 30, 0)).lights).toBeCloseTo(0.2);
    expect(nightSide(project(20, 90, 0)).lights).toBeCloseTo(0.2);
  });

  it('smoulders from the first failing check, burning brighter with more', () => {
    expect(nightSide(project(1, 0, 1)).unrest).toBeCloseTo(0.4);
    expect(nightSide(project(1, 0, 2)).unrest).toBeCloseTo(0.6);
    expect(nightSide(project(1, 0, 9)).unrest).toBe(1);
  });
});
