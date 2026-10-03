import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ProjectSnapshot } from '../projects/project.types';
import { ProjectsState } from '../projects/projects-feed';
import { PROJECTS_STATE } from '../projects/projects-source';
import { ACTIVITY_LOOKUPS, ActivityLookups, Lookup, PullState } from './activity-lookups';
import { ActivityWatch, UNREAD_TITLE } from './activity-watch';
import { ActivityItem } from './activity.types';

const NO_COUNTS = {
  conflicted: 0,
  failing: 0,
  unknown: 0,
  unlinked: 0,
  unreviewed: 0,
  unclaimed: 0,
};

const alpha = (openPulls: number[], openIssues: number[]): ProjectSnapshot => ({
  name: 'alpha',
  repo: 'me/alpha',
  dashboardUrl: '/p/me/alpha',
  open: openPulls.length,
  counts: NO_COUNTS,
  openPulls,
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
  const issueTitle = vi.fn((_repo: string, number: number): Observable<Lookup<string>> =>
    of(found(`Issue ${number}`)),
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: PROJECTS_STATE, useValue: state },
      { provide: ACTIVITY_LOOKUPS, useValue: { pullState, issueTitle, ...lookups } },
    ],
  });
  const checks: (readonly ActivityItem[])[] = [];
  TestBed.inject(ActivityWatch).checks.subscribe((items) => checks.push(items));
  const read = (next: ProjectsState): void => {
    state.set(next);
    TestBed.tick();
  };
  return { read, checks, pullState, issueTitle };
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
      issueTitle: (_repo, number) =>
        of<Lookup<string>>(number === 7 ? found('Crash on load') : { status: 'failed' }),
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

  it('tells each event once a session, even if it comes round again', () => {
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
    const { read, checks, issueTitle } = setUp({ pullState: refused });
    read(ready(0, alpha([10, 12], [5])));
    read(ready(5, alpha([12], [5, 13])));

    read(ready(10, alpha([], [5, 13, 14])));

    expect(checks).toEqual([]);
    expect(refused).toHaveBeenCalledTimes(1);
    expect(issueTitle).toHaveBeenCalledTimes(1);
  });
});
