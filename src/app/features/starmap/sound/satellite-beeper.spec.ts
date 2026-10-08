import { Satellite } from '../../../core/live-agents/satellites';
import { MIN_GAP_MS, SatelliteBeeper, nextBeep } from './satellite-beeper';

const satellite = (key: string, state: Satellite['state'] = 'working'): Satellite => ({
  key,
  name: key,
  state,
  pr: null,
  stateText: state,
});

describe('nextBeep', () => {
  it('beeps for nobody until a satellite’s period has passed', () => {
    const beepers = [{ key: 'a', everyMs: 1_500, lastAt: 1_000 }];

    expect(nextBeep(beepers, 2_000, -Infinity)).toBeNull();
    expect(nextBeep(beepers, 2_500, -Infinity)).toBe('a');
  });

  it('picks the satellite furthest past its period', () => {
    const beepers = [
      { key: 'a', everyMs: 1_500, lastAt: 0 },
      { key: 'b', everyMs: 1_500, lastAt: -900 },
    ];

    expect(nextBeep(beepers, 2_000, -Infinity)).toBe('b');
  });

  it('holds every beep until the last one is a gap behind', () => {
    const beepers = [{ key: 'a', everyMs: 100, lastAt: 0 }];

    expect(nextBeep(beepers, 5_000, 5_000 - MIN_GAP_MS + 1)).toBeNull();
    expect(nextBeep(beepers, 5_000, 5_000 - MIN_GAP_MS)).toBe('a');
  });
});

describe('SatelliteBeeper', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setUp() {
    let now = 1_000_000;
    const heard: string[] = [];
    const beeper = new SatelliteBeeper(
      (each) => heard.push(each.key),
      () => now,
    );
    const run = (ms: number): void => {
      for (let spent = 0; spent < ms; spent += 100) {
        now += 100;
        vi.advanceTimersByTime(100);
      }
    };
    return { beeper, heard, run };
  }

  it('beeps a working agent faster than a quiet one', () => {
    const { beeper, heard, run } = setUp();
    beeper.set([satellite('busy'), satellite('idle', 'quiet')], true);

    run(60_000);

    const count = (key: string): number => heard.filter((each) => each === key).length;
    expect(count('busy')).toBeGreaterThan(count('idle') * 3);
    expect(count('idle')).toBeGreaterThanOrEqual(5);
    beeper.dispose();
  });

  it('plays nothing while the sky cannot be heard, and starts once it can', () => {
    const { beeper, heard, run } = setUp();
    beeper.set([satellite('a')], false);
    run(10_000);
    expect(heard).toEqual([]);

    beeper.set([satellite('a')], true);
    run(10_000);

    expect(heard.length).toBeGreaterThan(0);
    beeper.dispose();
  });

  it('keeps a crowd of agents to a few beeps a second in all', () => {
    const { beeper, heard, run } = setUp();
    beeper.set(
      Array.from({ length: 40 }, (_, index) => satellite(`agent-${index}`)),
      true,
    );

    run(30_000);

    expect(heard.length).toBeLessThanOrEqual(30_000 / MIN_GAP_MS + 1);
    expect(heard.length).toBeGreaterThan(30);
    beeper.dispose();
  });

  it('stops ticking when no satellite is left', () => {
    const { beeper, heard, run } = setUp();
    beeper.set([satellite('a')], true);
    beeper.set([], true);

    run(20_000);

    expect(heard).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
