import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { USAGE_READ, UsageState } from './usage-reader';
import { USAGE_WATCH_MS, UsageWatch, keepReadings } from './usage-watch';

const READY: UsageState = {
  status: 'ready',
  document: { generatedAt: '2026-09-26T07:00:00Z', tools: [], projects: [] },
};

describe('keepReadings', () => {
  it('keeps what was read when a later read fails', () => {
    expect(keepReadings(READY, { status: 'unreachable' })).toBe(READY);
    expect(keepReadings({ status: 'reading' }, { status: 'missing' })).toEqual({
      status: 'missing',
    });
  });
});

describe('UsageWatch', () => {
  function setUp() {
    const answers: Subject<UsageState>[] = [];
    TestBed.configureTestingModule({
      providers: [
        UsageWatch,
        {
          provide: USAGE_READ,
          useValue: () => {
            const answer = new Subject<UsageState>();
            answers.push(answer);
            return answer;
          },
        },
      ],
    });
    return { watch: TestBed.inject(UsageWatch), answers };
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads now and every minute while started, and not after it stops', () => {
    const { watch, answers } = setUp();

    watch.start();
    vi.advanceTimersByTime(0);
    answers[0].next(READY);
    expect(watch.state()).toBe(READY);

    vi.advanceTimersByTime(USAGE_WATCH_MS);
    expect(answers.length).toBe(2);

    watch.stop();
    vi.advanceTimersByTime(3 * USAGE_WATCH_MS);
    expect(answers.length).toBe(2);
  });

  it('starts once however often it is asked', () => {
    const { watch, answers } = setUp();

    watch.start();
    watch.start();
    vi.advanceTimersByTime(0);

    expect(answers.length).toBe(1);
  });

  it('says it is refreshing until the read answers', () => {
    const { watch, answers } = setUp();

    watch.refresh();
    expect(watch.isRefreshing()).toBe(true);

    answers[0].next(READY);
    answers[0].complete();

    expect(watch.isRefreshing()).toBe(false);
    expect(watch.state()).toBe(READY);
  });
});
