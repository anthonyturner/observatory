import { FrameLoop, FrameLoopOptions, FrameScheduler, STILL_TIME } from './frame-loop';

class FakeScheduler implements FrameScheduler {
  hidden = false;
  ms = 0;
  private pending: ((ms: number) => void)[] = [];

  request(callback: (ms: number) => void): void {
    this.pending.push(callback);
  }

  isHidden(): boolean {
    return this.hidden;
  }

  nowMs(): number {
    return this.ms;
  }

  /** Runs the frames waiting, `stepMs` apart. */
  advance(stepMs: number, frames = 1): void {
    for (let i = 0; i < frames; i++) {
      this.ms += stepMs;
      const due = this.pending;
      this.pending = [];
      due.forEach((callback) => callback(this.ms));
    }
  }

  get waiting(): number {
    return this.pending.length;
  }
}

function setup(overrides: Partial<FrameLoopOptions> = {}) {
  const scheduler = new FakeScheduler();
  const drawn: number[] = [];
  const errors: unknown[] = [];
  const loop = new FrameLoop({
    scheduler,
    draw: (time) => drawn.push(time),
    framesPerSecond: () => 30,
    isStill: () => false,
    onError: (error) => errors.push(error),
    ...overrides,
  });
  return { scheduler, drawn, errors, loop };
}

describe('FrameLoop', () => {
  it('draws within its frame budget', () => {
    const { scheduler, drawn, loop } = setup();
    loop.kick();
    scheduler.advance(1000 / 60, 60);
    expect(drawn.length).toBeGreaterThanOrEqual(29);
    expect(drawn.length).toBeLessThanOrEqual(31);
  });

  it('draws one frame at the still moment, then waits for the next kick', () => {
    const { scheduler, drawn, loop } = setup({ isStill: () => true });
    loop.kick();
    scheduler.advance(16, 5);
    expect(drawn).toEqual([STILL_TIME]);
    expect(scheduler.waiting).toBe(0);
  });

  it('stops while the page is hidden and resumes on a kick', () => {
    const { scheduler, drawn, loop } = setup();
    loop.kick();
    scheduler.hidden = true;
    scheduler.advance(50);
    expect(scheduler.waiting).toBe(0);
    scheduler.hidden = false;
    loop.kick();
    scheduler.advance(50);
    expect(drawn).toHaveLength(1);
  });

  it('keeps running after a frame throws, and reports only the first', () => {
    const { scheduler, errors, loop } = setup({
      draw: () => {
        throw new Error('lost context');
      },
    });
    loop.kick();
    scheduler.advance(50, 3);
    expect(errors).toHaveLength(1);
    expect(scheduler.waiting).toBe(1);
  });

  it('never runs again once stopped', () => {
    const { scheduler, drawn, loop } = setup();
    loop.stop();
    loop.kick();
    scheduler.advance(50);
    expect(drawn).toHaveLength(0);
  });
});
