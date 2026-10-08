import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MilestonesQuietTab } from './milestones-quiet-tab';
import { hasNothingIn } from './milestones-presence';
import {
  DAY_MS,
  Milestone,
  dueStateOf,
  parseMilestonesReport,
  progressOf,
} from './milestones-report';
import { BARE_REPORT, RAW_REPORT, rawMilestone } from './testing/milestones-fixture';

const NOW = Date.parse('2026-10-08T13:00:00Z');

const milestone = (more: Partial<Milestone> = {}): Milestone => ({
  number: 1,
  title: 'v1',
  description: null,
  url: 'https://github.com/me/app/milestone/1',
  isOpen: true,
  dueOn: null,
  closedAt: null,
  open: 1,
  closed: 1,
  items: [],
  ...more,
});

describe('parseMilestonesReport', () => {
  it('reads the milestones, their items, and the discussions', () => {
    const report = parseMilestonesReport(RAW_REPORT);

    expect(report?.milestones.open.map((each) => each.title)).toEqual([
      'Beta',
      'Launch',
      'Someday',
    ]);
    expect(report?.milestones.closed[0].closedAt).toBe(Date.parse('2026-09-20T00:00:00Z'));
    expect(report?.milestones.open[0].items.map((item) => [item.number, item.state])).toEqual([
      [11, 'open'],
      [21, 'merged'],
    ]);
    expect(report?.discussions.threads.map((each) => each.category)).toEqual([
      'Q&A',
      'Ideas',
      'Q&A',
    ]);
    expect(report?.discussions.total).toBe(12);
    expect(report?.milestones.openCount).toBe(3);
  });

  it('drops a link that is not GitHub’s, and refuses an answer that is not a report', () => {
    const report = parseMilestonesReport({
      ...RAW_REPORT,
      milestones: { note: null, open: [rawMilestone(5, { url: 'https://evil.example/5' })] },
    });

    expect(report?.milestones.open).toEqual([]);
    expect(parseMilestonesReport({ repo: 'me/app' })).toBeNull();
    expect(parseMilestonesReport('nope')).toBeNull();
  });
});

describe('progressOf', () => {
  it('is the done share of every item, and none for an empty milestone', () => {
    expect(progressOf(milestone({ open: 1, closed: 3 }))).toBe(0.75);
    expect(progressOf(milestone({ open: 0, closed: 0 }))).toBe(0);
  });
});

describe('dueStateOf', () => {
  const due = (offsetDays: number) => NOW + offsetDays * DAY_MS;

  it('reads nothing left open as done, whatever the date', () => {
    expect(dueStateOf(milestone({ open: 0, closed: 4, dueOn: due(-30) }), NOW)).toBe('done');
  });

  it('is overdue only once its due day is over, soon within a week, later past that', () => {
    expect(dueStateOf(milestone({ dueOn: due(-0.5) }), NOW)).toBe('soon');
    expect(dueStateOf(milestone({ dueOn: due(-1) }), NOW)).toBe('overdue');
    expect(dueStateOf(milestone({ dueOn: due(5) }), NOW)).toBe('soon');
    expect(dueStateOf(milestone({ dueOn: due(10) }), NOW)).toBe('later');
    expect(dueStateOf(milestone(), NOW)).toBe('open-ended');
  });
});

describe('hasNothingIn', () => {
  it('is true only for no milestones and no discussions, both read', () => {
    expect(hasNothingIn(BARE_REPORT)).toBe(true);
    expect(hasNothingIn(RAW_REPORT)).toBe(false);
    expect(
      hasNothingIn({
        ...BARE_REPORT,
        discussions: { note: null, isEnabled: true, total: 3, threads: [] },
      }),
    ).toBe(false);
    expect(
      hasNothingIn({ ...BARE_REPORT, milestones: { note: 'GitHub did not answer', open: [] } }),
    ).toBe(false);
    expect(hasNothingIn(null)).toBe(false);
  });
});

describe('MilestonesQuietTab', () => {
  it('asks the API about the project, and leaves the tab be when it cannot tell', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const quiet = TestBed.inject(MilestonesQuietTab);
    const http = TestBed.inject(HttpTestingController);
    const answers: boolean[] = [];

    quiet.isEmpty('me/bare').subscribe((answer) => answers.push(answer));
    http.expectOne('/api/milestones?repo=me/bare').flush(BARE_REPORT);
    quiet.isEmpty('me/down').subscribe((answer) => answers.push(answer));
    http
      .expectOne('/api/milestones?repo=me/down')
      .flush('', { status: 502, statusText: 'Bad Gateway' });

    expect(answers).toEqual([true, false]);
  });
});
