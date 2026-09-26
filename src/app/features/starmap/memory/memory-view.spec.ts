import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HistoryFeed } from '../../../core/queue/history-feed';
import { LedgerFeed } from '../../../core/queue/ledger-feed';
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
