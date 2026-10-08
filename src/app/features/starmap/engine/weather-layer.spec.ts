import { DesignFlag, FlagKind, PullWeather } from '../../../core/queue/weather';
import { FULL_STORM_WEIGHT, stormOf } from './weather-layer';

const flag = (kind: FlagKind): DesignFlag => ({
  kind,
  path: 'src/a.ts',
  line: 1,
  note: '',
  excerpt: '',
});

const weather = (kinds: readonly FlagKind[], scanned = true): PullWeather => ({
  number: 7,
  headSha: 'abc',
  scanned,
  flags: kinds.map(flag),
});

describe('stormOf', () => {
  it('leaves a clean pull request clear, and one not scanned with no weather at all', () => {
    expect(stormOf(weather([]))).toBeNull();
    expect(stormOf(weather(['swallowed-error'], false))).toBeNull();
    expect(stormOf(undefined)).toBeNull();
  });

  it('gathers a haze for one stray TODO', () => {
    const storm = stormOf(weather(['untracked-todo']));
    expect(storm?.level).toBe('haze');
    expect(storm?.strength).toBeCloseTo(1 / FULL_STORM_WEIGHT);
    expect(storm?.debris).toBe(2);
  });

  it('weighs a discarded error heavier than a TODO', () => {
    const todo = stormOf(weather(['untracked-todo']));
    const swallowed = stormOf(weather(['swallowed-error']));
    expect(swallowed?.strength ?? 0).toBeGreaterThan(todo?.strength ?? 0);
    expect(swallowed?.reach ?? 0).toBeGreaterThan(todo?.reach ?? 0);
  });

  it('grows from haze to squall to storm as the flags pile up', () => {
    expect(stormOf(weather(['pass-through', 'silenced-check']))?.level).toBe('squall');
    expect(
      stormOf(weather(['swallowed-error', 'swallowed-error', 'pass-through', 'silenced-check']))
        ?.level,
    ).toBe('storm');
  });

  it('stops growing at a full storm, with bounded debris', () => {
    const full = stormOf(weather(Array<FlagKind>(10).fill('swallowed-error')));
    const more = stormOf(weather(Array<FlagKind>(40).fill('swallowed-error')));
    expect(full?.strength).toBe(1);
    expect(more?.reach).toBe(full?.reach);
    expect(more?.debris).toBe(28);
  });
});
