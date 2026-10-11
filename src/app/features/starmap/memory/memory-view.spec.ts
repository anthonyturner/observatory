import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import {
  ACTIVITY_LOOKUPS,
  IssueState,
  Lookup,
  PullState,
} from '../../../core/activity/activity-lookups';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { LedgerFeed } from '../../../core/queue/ledger-feed';
import { EMPTY_SYSTEM, StarSystem } from './departure';
import { MemoryView } from './memory-view';
import { MemoryItem } from './news';

const frames = [
  {
    at: '2026-09-25T10:00:00Z',
    items: [{ number: 1, title: '#1', bucket: 'unreviewed', idleDays: 1 }],
    departed: [],
  },
  {
    at: '2026-09-26T10:00:00Z',
    items: [{ number: 1, title: '#1', bucket: 'failing', idleDays: 2 }],
    departed: [],
  },
];
const now: MemoryItem[] = [{ pr: 1, title: '#1', bucket: 'failing', idleDays: 2 }];
const SNAPSHOT = '2026-09-26T10:00:05Z';

function setUp() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      HistoryFeed,
      LedgerFeed,
      MemoryView,
    ],
  });
  const memory = TestBed.inject(MemoryView);
  memory.watch('me/a');
  TestBed.inject(HistoryFeed).load('me/a');
  TestBed.inject(HttpTestingController)
    .expectOne('/api/history?repo=me/a')
    .flush({ repo: 'me/a', frames });
  const played: unknown[][] = [];
  memory.onPlay = (events) => played.push([...events]);
  return { memory, played };
}

describe('MemoryView', () => {
  beforeEach(() => localStorage.clear());

  it('announces once, on a first visit, what the latest refresh changed', () => {
    const { memory } = setUp();

    const events = memory.announce(SNAPSHOT, now);

    expect(events.map((e) => [e.kind, e.pr])).toEqual([['blocked', 1]]);
    expect(memory.news().label).toBe('since the previous refresh');
    expect(memory.announce(SNAPSHOT, now)).toEqual([]);
  });

  it('remembers the snapshot you saw when you say Got it, and clears the marks', () => {
    const { memory } = setUp();
    memory.announce(SNAPSHOT, now);

    memory.acknowledge();

    expect(memory.news().acknowledged).toBe(true);
    expect(localStorage.getItem('observatory.seen.me/a')).toBe(SNAPSHOT);
  });

  it('replays a refresh with what it changed, and steps back to now', () => {
    const { memory, played } = setUp();
    memory.announce(SNAPSHOT, now);

    memory.showFrame(1);
    expect(memory.replay()?.index).toBe(1);
    expect(memory.news().label).toBe('refresh 2 of 2');
    expect(played.at(-1)?.length).toBe(1);

    memory.step(1);
    expect(memory.replay()).toBeNull();
    expect(memory.news().label).toBe('since the previous refresh');
  });

  it('ends replay without playing when the viewer leaves the queue', () => {
    const { memory, played } = setUp();
    memory.showFrame(0);
    const before = played.length;

    memory.endReplay();

    expect(memory.replay()).toBeNull();
    expect(played.length).toBe(before);
  });
});

describe('MemoryView departures', () => {
  const queue = (...numbers: number[]): MemoryItem[] =>
    numbers.map((pr) => ({ pr, title: `#${pr}`, bucket: 'fresh', idleDays: 1 }));
  /** A reading of the queue: `stars` are in the sky, `putAway` are listed but dismissed or snoozed. */
  const read = (
    memory: MemoryView,
    stars: MemoryItem[],
    systems = new Map<number, StarSystem>(),
    putAway: number[] = [],
  ): void => memory.follow(stars, new Set([...stars.map((s) => s.pr), ...putAway]), systems);
  const carrying = (pr: number): StarSystem => ({
    ...EMPTY_SYSTEM,
    meteor: { repo: 'me/a', pr, commits: 4 },
  });
  const threads = { resolved: 2, unresolved: 1 };
  const found = (value: PullState): Lookup<PullState> => ({ status: 'found', value });
  const squashed = found({
    state: 'MERGED',
    title: '#2',
    ending: { how: 'squash', threads, closes: [20] },
  });

  function setUpLive() {
    const asked: [string, number][] = [];
    const answers = new Map<number, Observable<Lookup<PullState>>>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        HistoryFeed,
        LedgerFeed,
        MemoryView,
        {
          provide: ACTIVITY_LOOKUPS,
          useValue: {
            pullState: (repo: string, number: number) => {
              asked.push([repo, number]);
              return answers.get(number) ?? of<Lookup<PullState>>({ status: 'failed' });
            },
            issue: () => of<Lookup<IssueState>>({ status: 'failed' }),
          },
        },
      ],
    });
    const memory = TestBed.inject(MemoryView);
    memory.watch('me/a');
    return { memory, asked, answers };
  }

  it('only sets the point to compare with on the first reading', () => {
    const { memory, asked } = setUpLive();

    read(memory, queue(1, 2), new Map());

    expect(memory.waiting()).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('notices a pull request that left, asking GitHub once how it ended', () => {
    const { memory, asked, answers } = setUpLive();
    answers.set(2, of(squashed));
    read(memory, queue(1, 2), new Map([[2, carrying(2)]]));

    read(memory, queue(1), new Map());
    read(memory, queue(1), new Map());

    expect(asked).toEqual([['me/a', 2]]);
    const [event] = memory.waiting();
    expect(event).toMatchObject({ kind: 'squashed', pr: 2, title: '#2', bucket: 'fresh' });
    expect(event.departure?.system).toEqual(carrying(2));
    expect(event.departure?.ending).toEqual({
      fate: 'merged',
      how: 'squash',
      threads,
      closes: [20],
    });
  });

  it('notices on every refresh, not only the first of a visit', () => {
    const { memory, answers } = setUpLive();
    answers.set(1, of(found({ state: 'CLOSED', title: '#1' })));
    answers.set(2, of(squashed));
    read(memory, queue(1, 2, 3), new Map());

    read(memory, queue(2, 3), new Map());
    read(memory, queue(3), new Map());

    expect(memory.waiting().map((e) => [e.kind, e.pr])).toEqual([
      ['closed', 1],
      ['squashed', 2],
    ]);
  });

  it('lets a pull request put away stay out of the news, for it has not left', () => {
    const { memory, asked } = setUpLive();
    read(memory, queue(1, 2));

    read(memory, queue(1), new Map(), [2]);

    expect(asked).toEqual([]);
    expect(memory.waiting()).toEqual([]);
  });

  it('has no exit for a pull request that was put away before it merged', () => {
    const { memory, asked } = setUpLive();
    read(memory, queue(1), new Map(), [2]);

    read(memory, queue(1));

    expect(asked).toEqual([]);
    expect(memory.waiting()).toEqual([]);
  });

  it('lets a pull request still open on GitHub stay out of the news', () => {
    const { memory, answers } = setUpLive();
    answers.set(2, of(found({ state: 'OPEN', title: '#2' })));
    read(memory, queue(1, 2), new Map());

    read(memory, queue(1), new Map());

    expect(memory.waiting()).toEqual([]);
  });

  it('lets a pull request GitHub cannot be asked about simply leave', () => {
    const { memory } = setUpLive();
    read(memory, queue(1, 2), new Map());

    read(memory, queue(1), new Map());

    expect(memory.waiting().map((e) => [e.kind, e.pr])).toEqual([['left', 2]]);
  });

  it('hands what waits to the sky once, and keeps it for the sky to draw', () => {
    const { memory, answers } = setUpLive();
    answers.set(2, of(squashed));
    read(memory, queue(1, 2), new Map());
    read(memory, queue(1), new Map());

    const released = memory.release();

    expect(released.map((e) => e.pr)).toEqual([2]);
    expect(memory.waiting()).toEqual([]);
    expect(memory.departures()).toEqual(released);
    expect(memory.release()).toEqual([]);
    expect(memory.departures()).toEqual(released);
  });

  it('forgets an answer still on its way when another repository is watched', () => {
    const { memory, answers } = setUpLive();
    const late = new Subject<Lookup<PullState>>();
    answers.set(2, late);
    read(memory, queue(1, 2), new Map());
    read(memory, queue(1), new Map());

    memory.watch('me/b');
    late.next(squashed);

    expect(memory.waiting()).toEqual([]);
    expect(memory.departures()).toEqual([]);
  });
});
