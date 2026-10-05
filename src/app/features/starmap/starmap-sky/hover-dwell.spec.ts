import { HOVER_DWELL_MS, HoverDwell } from './hover-dwell';

describe('HoverDwell', () => {
  let settled: number[];
  let dwell: HoverDwell<number>;

  beforeEach(() => {
    vi.useFakeTimers();
    settled = [];
    dwell = new HoverDwell((value) => settled.push(value));
  });

  afterEach(() => vi.useRealTimers());

  it('settles on a thing the pointer rests over', () => {
    dwell.aim('7', 7);
    vi.advanceTimersByTime(HOVER_DWELL_MS);
    expect(settled).toEqual([7]);
  });

  it('skips the things a sweep only passes over', () => {
    dwell.aim('7', 7);
    vi.advanceTimersByTime(HOVER_DWELL_MS / 2);
    dwell.aim(null, null);
    dwell.aim('9', 9);
    vi.advanceTimersByTime(HOVER_DWELL_MS);
    expect(settled).toEqual([9]);
  });

  it('settles once per visit, however long the pointer stays', () => {
    dwell.aim('7', 7);
    vi.advanceTimersByTime(HOVER_DWELL_MS);
    dwell.aim('7', 7);
    vi.advanceTimersByTime(HOVER_DWELL_MS * 3);
    expect(settled).toEqual([7]);
    dwell.aim(null, null);
    dwell.aim('7', 7);
    vi.advanceTimersByTime(HOVER_DWELL_MS);
    expect(settled).toEqual([7, 7]);
  });

  it('drops a rest still waiting when cancelled', () => {
    dwell.aim('7', 7);
    dwell.cancel();
    vi.advanceTimersByTime(HOVER_DWELL_MS);
    expect(settled).toEqual([]);
  });
});
