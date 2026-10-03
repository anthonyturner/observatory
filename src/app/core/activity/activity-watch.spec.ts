import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ListedPull, ProjectSnapshot } from '../projects/project.types';
import { ProjectsState } from '../projects/projects-feed';
import { PROJECTS_STATE } from '../projects/projects-source';
import {
  ACTIVITY_LOOKUPS,
  ActivityLookups,
  IssueState,
  Lookup,
  PullState,
} from './activity-lookups';
import { ActivityWatch, UNREAD_PULL_TITLE, UNREAD_TITLE } from './activity-watch';
import { ActivityItem } from './activity.types';

const NO_COUNTS = {
  conflicted: 0,
  failing: 0,
  unknown: 0,
  unlinked: 0,
  unreviewed: 0,
  unclaimed: 0,
};

/** A pull request given by number alone is titled "Pull <n>" and closes nothing. */
const listed = (pull: number | ListedPull): ListedPull =>
  typeof pull === 'number' ? { number: pull, title: `Pull ${pull}`, closes: [] } : pull;

const alpha = (openPulls: (number | ListedPull)[], openIssues: number[]): ProjectSnapshot => ({
  name: 'alpha',
  repo: 'me/alpha',
  dashboardUrl: '/p/me/alpha',
  open: openPulls.length,
  counts: NO_COUNTS,
  openPulls: openPulls.map(listed),
  openIssues,
});

const ready = (minute: number, project: ProjectSnapshot): ProjectsState => ({
  status: 'ready',
  report: {
    generatedAt: `2026-10-03T12:${String(minute).padStart(2, '0')}:00Z`,
    projects: [project],
    directives: [],
  },
});

const found = <T>(value: T): Lookup<T> => ({ status: 'found', value });

function setUp(lookups: Partial<ActivityLookups> = {}) {
  const state = signal<ProjectsState>({ status: 'reading' });
  const pullState = vi.fn((_repo: string, number: number): Observable<Lookup<PullState>> =>
    of(found<PullState>({ state: 'MERGED', title: `Pull ${number}` })),
  );
  const issue = vi.fn((_repo: string, number: number): Observable<Lookup<IssueState>> =>
    of(found<IssueState>({ title: `Issue ${number}`, closedAt: '2026-10-03T12:03:00Z' })),
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: PROJECTS_STATE, useValue: state },
      { provide: ACTIVITY_LOOKUPS, useValue: { pullState, issue, ...lookups } },
    ],
  });
  const checks: (readonly ActivityItem[])[] = [];
  TestBed.inject(ActivityWatch).checks.subscribe((items) => checks.push(items));
  const read = (next: ProjectsState): void => {
    state.set(next);
    TestBed.tick();
  };
  return { read, checks, pullState, issue };
}

describe('ActivityWatch', () => {
  it('tells nothing about what already existed when the page loads', () => {
    const { read, checks, pullState } = setUp();

    read(ready(0, alpha([10, 12], [5])));

    expect(checks).toEqual([]);
    expect(pullState).not.toHaveBeenCalled();
  });

  it('tells of a pull request that left the queue merged', () => {
    const { read, checks, pullState } = setUp();
    read(ready(0, alpha([10, 12], [5])));

    read(ready(5, alpha([12], [5])));

    expect(pullState).toHaveBeenCalledWith('me/alpha', 10);
    expect(checks).toEqual([
      [{ kind: 'merged', repo: 'me/alpha', label: 'alpha', number: 10, title: 'Pull 10' }],
    ]);
  });

  it('says nothing of a pull request closed unmerged', () => {
    const { read, checks } = setUp({
      pullState: () => of(found<PullState>({ state: 'CLOSED', title: 'Dropped' })),
    });
    read(ready(0, alpha([10], [5])));

    read(ready(5, alpha([], [5])));

    expect(checks).toEqual([]);
  });

  it('tells of a new issue with its title, or a stand-in where it could not be read', () => {
    const { read, checks } = setUp({
      issue: (_repo, number) =>
        of<Lookup<IssueState>>(
          number === 7 ? found({ title: 'Crash on load', closedAt: null }) : { status: 'failed' },
        ),
    });
    read(ready(0, alpha([], [5])));

    read(ready(5, alpha([], [5, 7, 8])));

    expect(checks).toEqual([
      [
        { kind: 'issue', repo: 'me/alpha', label: 'alpha', number: 7, title: 'Crash on load' },
        { kind: 'issue', repo: 'me/alpha', label: 'alpha', number: 8, title: UNREAD_TITLE },
      ],
    ]);
  });

  it('puts one check’s merged pull requests before its new issues', () => {
    const { read, checks } = setUp();
    read(ready(0, alpha([10], [5])));

    read(ready(5, alpha([], [5, 11])));

    expect(checks[0].map((item) => item.kind)).toEqual(['merged', 'issue']);
  });

  it('tells each event once a tab, even if it comes round again', () => {
    const { read, checks, pullState } = setUp();
    read(ready(0, alpha([10], [5])));
    read(ready(5, alpha([], [5])));

    read(ready(10, alpha([10], [5])));
    read(ready(15, alpha([], [5])));

    expect(checks).toHaveLength(1);
    expect(pullState).toHaveBeenCalledTimes(1);
  });

  it('ignores a projects read that failed, and compares the next good one with the last', () => {
    const { read, checks } = setUp();
    read(ready(0, alpha([10], [5])));

    read({ status: 'unreachable' });
    read(ready(5, alpha([], [5])));

    expect(checks.flat().map((item) => item.number)).toEqual([10]);
  });

  it('goes quiet for the session once the API refuses a lookup', () => {
    const refused = vi.fn(() => of<Lookup<PullState>>({ status: 'denied' }));
    const { read, checks, issue } = setUp({ pullState: refused });
    read(ready(0, alpha([10, 12], [5])));
    read(ready(5, alpha([12], [5, 13])));

    read(ready(10, alpha([], [5, 13, 14])));

    expect(checks).toEqual([]);
    expect(refused).toHaveBeenCalledTimes(1);
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('tells of a pull request opened, by its title, without reading anything', () => {
    const { read, checks, pullState, issue } = setUp();
    read(ready(0, alpha([10], [5])));

    read(ready(5, alpha([10, { number: 11, title: 'Transport bar', closes: [] }], [5])));

    expect(checks).toEqual([
      [
        {
          kind: 'pull-opened',
          repo: 'me/alpha',
          label: 'alpha',
          number: 11,
          title: 'Transport bar',
        },
      ],
    ]);
    expect(pullState).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
  });

  it('names a pull request opened with a stand-in when the report gave no title', () => {
    const { read, checks } = setUp();
    read(ready(0, alpha([10], [5])));

    read(ready(5, alpha([10, { number: 11, title: null, closes: [] }], [5])));

    expect(checks.flat().map((item) => item.title)).toEqual([UNREAD_PULL_TITLE]);
  });

  it('tells of no pull request opened on the first read of a repository', () => {
    const { read, checks } = setUp();

    read(ready(0, alpha([10, 11], [5])));

    expect(checks).toEqual([]);
  });

  it('never counts a reopened pull request as opened', () => {
    const { read, checks } = setUp({
      pullState: () => of(found<PullState>({ state: 'CLOSED', title: 'Dropped' })),
    });
    read(ready(0, alpha([10, 12], [5])));
    read(ready(5, alpha([12], [5])));

    read(ready(10, alpha([10, 12], [5])));

    expect(checks).toEqual([]);
  });

  it('tells of an issue that left the open list and GitHub says closed', () => {
    const issue = vi.fn(() =>
      of(found<IssueState>({ title: 'Crash on load', closedAt: '2026-10-03T12:04:00Z' })),
    );
    const { read, checks } = setUp({ issue });
    read(ready(0, alpha([], [5, 7])));

    read(ready(5, alpha([], [7])));

    expect(issue).toHaveBeenCalledWith('me/alpha', 5);
    expect(checks).toEqual([
      [
        {
          kind: 'issue-closed',
          repo: 'me/alpha',
          label: 'alpha',
          number: 5,
          title: 'Crash on load',
        },
      ],
    ]);
  });

  it('says nothing of an issue that left the list without closing, or could not be read', () => {
    const { read, checks } = setUp({
      issue: (_repo, number) =>
        of<Lookup<IssueState>>(
          number === 5 ? found({ title: 'Transferred', closedAt: null }) : { status: 'failed' },
        ),
    });
    read(ready(0, alpha([], [5, 6, 7])));

    read(ready(5, alpha([], [7])));

    expect(checks).toEqual([]);
  });

  it('tells of no issue closed while the issue list is unknown, or the project unreadable', () => {
    const { read, checks, issue } = setUp();
    read(ready(0, alpha([], [5, 7])));

    read(ready(5, { ...alpha([], []), openIssues: undefined }));
    read(
      ready(10, { ...alpha([], []), openIssues: undefined, openPulls: undefined, error: 'down' }),
    );

    expect(checks).toEqual([]);
    expect(issue).not.toHaveBeenCalled();
  });

  it('tells a merge and the issue it closes in the same check as one item', () => {
    const { read, checks } = setUp({
      pullState: () => of(found<PullState>({ state: 'MERGED', title: 'Transport bar fix' })),
    });
    read(ready(0, alpha([{ number: 12, title: 'Transport bar fix', closes: [10] }], [10, 11])));

    read(ready(5, alpha([], [])));

    expect(checks).toEqual([
      [
        {
          kind: 'merged',
          repo: 'me/alpha',
          label: 'alpha',
          number: 12,
          title: 'Transport bar fix',
          closing: [{ number: 10, title: 'Issue 10' }],
        },
        { kind: 'issue-closed', repo: 'me/alpha', label: 'alpha', number: 11, title: 'Issue 11' },
      ],
    ]);
  });

  it('tells an issue a merge folded in only once, even if it closes again', () => {
    const { read, checks } = setUp();
    read(ready(0, alpha([{ number: 12, title: 'Fix', closes: [10] }], [10])));
    read(ready(5, alpha([], [])));

    read(ready(10, alpha([], [10])));
    read(ready(15, alpha([], [])));

    expect(checks).toHaveLength(1);
  });

  it('reads once per pull request or issue that left, and nothing for one opened', () => {
    const { read, pullState, issue } = setUp();
    read(ready(0, alpha([10, 12], [5, 7])));

    read(ready(5, alpha([12, 13, 14], [7, 15])));
    read(ready(10, alpha([12, 13, 14], [7, 15])));

    expect(pullState.mock.calls).toEqual([['me/alpha', 10]]);
    // Issue 5 left; issue 15 is new, and is read once for its title.
    expect(issue.mock.calls).toEqual([
      ['me/alpha', 5],
      ['me/alpha', 15],
    ]);
  });

  it('reads nothing while no new projects report comes', () => {
    vi.useFakeTimers();
    try {
      const { read, pullState, issue } = setUp();
      read(ready(0, alpha([10], [5])));

      vi.advanceTimersByTime(60 * 60_000);
      TestBed.tick();

      expect(pullState).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
