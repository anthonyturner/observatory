import { TestBed } from '@angular/core/testing';
import { Clock } from './clock';

describe('Clock', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 8, 25, 9, 0, 0) }));
  afterEach(() => vi.useRealTimers());

  it('moves on once a second', () => {
    const clock = TestBed.inject(Clock);

    vi.advanceTimersByTime(3000);

    expect(clock.now().getSeconds()).toBe(3);
  });
});
