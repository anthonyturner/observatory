import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProgressFeed } from './progress-feed';
import { ProjectsState } from './projects-feed';
import { PROJECTS_STATE } from './projects-source';
import { ProjectSnapshot } from './project.types';

const COUNTS = { conflicted: 0, failing: 0, unknown: 0, unlinked: 0, unreviewed: 0, unclaimed: 0 };
const report = (at: string, issues: number): ProjectsState => ({
  status: 'ready',
  report: {
    generatedAt: at,
    directives: [],
    projects: [
      {
        name: 'a',
        repo: 'o/a',
        dashboardUrl: '',
        open: 2,
        issues,
        counts: COUNTS,
      } as ProjectSnapshot,
    ],
  },
});

describe('ProgressFeed', () => {
  function setup() {
    const state = signal<ProjectsState>({ status: 'reading' });
    TestBed.configureTestingModule({ providers: [{ provide: PROJECTS_STATE, useValue: state }] });
    const feed = TestBed.inject(ProgressFeed);
    return { state, feed };
  }

  it('takes the first report as the baseline, and celebrates what the next one shows done', () => {
    const { state, feed } = setup();
    state.set(report('t1', 5));
    TestBed.tick();
    expect(feed.latest()).toBeNull();

    state.set(report('t2', 3));
    TestBed.tick();
    expect(feed.latest()?.progress).toEqual([{ key: 'o/a', closedIssues: 2, finishedPulls: 0 }]);
  });

  it('says nothing when a report shows no progress', () => {
    const { state, feed } = setup();
    state.set(report('t1', 5));
    TestBed.tick();
    state.set(report('t2', 6));
    TestBed.tick();
    expect(feed.latest()).toBeNull();
  });
});
