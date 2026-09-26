import { ProjectSnapshot } from '../projects/project.types';
import { moodOf, withMood } from './core-mood';
import { CORE_STATES } from './core-states';

const COUNTS = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const project = (overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  name: 'p',
  repo: 'o/p',
  dashboardUrl: '',
  open: 1,
  counts: COUNTS,
  ...overrides,
});
const blocked = (conflicted: number): ProjectSnapshot =>
  project({ counts: { ...COUNTS, conflicted } });

describe('moodOf', () => {
  it('is calm with nothing blocked', () => {
    const mood = moodOf([project(), project()]);
    expect(mood.name).toBe('calm');
    expect(mood.stress).toBe(0);
    expect(mood.reason).toBe('nothing blocked');
  });

  it('grows uneasy, then strained, as blocked projects and stuck PRs pile up', () => {
    expect(moodOf([blocked(1)]).name).toBe('uneasy');
    expect(moodOf([blocked(12), blocked(3), blocked(1)]).name).toBe('strained');
    expect(moodOf([blocked(12)]).stress).toBeGreaterThan(moodOf([blocked(1)]).stress);
  });

  it('never treats a project it could not read as healthy', () => {
    const mood = moodOf([project({ error: 'rate limit' }), project({ error: 'rate limit' })]);
    expect(mood.stress).toBeGreaterThan(0);
    expect(mood.reason).toBe('2 not worked out');
  });

  it('says why in words', () => {
    expect(moodOf([blocked(2), blocked(1)]).reason).toBe('2 blocked projects, 3 stuck PRs');
  });
});

describe('withMood', () => {
  it('leaves a state alone when calm', () => {
    const calm = moodOf([project()]);
    expect(withMood(CORE_STATES.idle, calm)).toEqual(CORE_STATES.idle);
  });

  it('quickens, deepens and turns faster under strain', () => {
    const strained = { name: 'strained' as const, stress: 1, reason: '' };
    const state = withMood(CORE_STATES.idle, strained);
    expect(state.period).toBeLessThan(CORE_STATES.idle.period);
    expect(state.breathe).toBeGreaterThan(CORE_STATES.idle.breathe);
    expect(state.turn).toBeGreaterThan(CORE_STATES.idle.turn);
    expect(state.ripple).toBeGreaterThan(0);
  });
});
