import { FramePace } from './frame-pace';

/** Every refresh of a display at `hz`, over one second, as the times it fires. */
const refreshes = (hz: number): number[] => Array.from({ length: hz }, (_, i) => (i + 1) / hz);

describe('FramePace', () => {
  it('draws ambient drift about 30 times a second, whatever the display rate', () => {
    for (const hz of [60, 120, 144]) {
      const pace = new FramePace();
      const drawn = refreshes(hz).filter((now) => pace.take(now, false)).length;

      expect(drawn).toBeGreaterThanOrEqual(28);
      expect(drawn).toBeLessThanOrEqual(30);
    }
  });

  it('draws every refresh while the viewer is interacting', () => {
    const pace = new FramePace();

    expect(refreshes(144).every((now) => pace.take(now, true))).toBe(true);
  });

  it('counts an interactive frame, so drift waits a full slot after it', () => {
    const pace = new FramePace();

    expect(pace.take(1, true)).toBe(true);
    expect(pace.take(1.016, false)).toBe(false);
    expect(pace.take(1.034, false)).toBe(true);
  });

  it('draws at once after a restart', () => {
    const pace = new FramePace();
    pace.take(1, false);

    pace.restart();

    expect(pace.take(1.001, false)).toBe(true);
  });
});
