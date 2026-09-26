import { QueueState, nextQueueState } from './queue-feed';
import { queueFog } from './queue-fog';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const ready = (minutesOld: number, isStale = true): QueueState => ({
  status: 'ready',
  report: {
    generatedAt: new Date(NOW - minutesOld * 60_000).toISOString(),
    repo: 'me/a',
    items: [],
  },
  isStale,
});

describe('nextQueueState', () => {
  it('keeps the queue it has, marked stale, when a read fails', () => {
    expect(nextQueueState(ready(5, false), { status: 'unreachable' })).toEqual(ready(5));
  });

  it('takes a good read, a refusal, or a failure with nothing to keep', () => {
    expect(nextQueueState(ready(5), ready(0, false))).toEqual(ready(0, false));
    expect(nextQueueState(ready(5), { status: 'refused', reason: 'no' }).status).toBe('refused');
    expect(nextQueueState({ status: 'reading' }, { status: 'unreachable' }).status).toBe(
      'unreachable',
    );
  });
});

describe('queueFog', () => {
  it('stays clear while reads succeed', () => {
    expect(queueFog(ready(90, false), NOW)).toBe(0);
    expect(queueFog({ status: 'reading' }, NOW)).toBe(0);
  });

  it('fogs thinly at once when stale, and fully after an hour', () => {
    expect(queueFog(ready(0), NOW)).toBeCloseTo(0.35);
    expect(queueFog(ready(30), NOW)).toBeCloseTo(0.675);
    expect(queueFog(ready(90), NOW)).toBe(1);
  });
});
