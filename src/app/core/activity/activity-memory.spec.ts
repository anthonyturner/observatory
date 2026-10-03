import { ListedPull, ProjectSnapshot } from '../projects/project.types';
import { ProjectsReport } from '../projects/projects-report';
import { ActivityMemory, EMPTY_MEMORY, compareReport } from './activity-memory';

const NO_COUNTS = {
  conflicted: 0,
  failing: 0,
  unknown: 0,
  unlinked: 0,
  unreviewed: 0,
  unclaimed: 0,
};

/** Open pull requests by number, each titled "Pull <n>" and closing nothing. */
const pulls = (...numbers: number[]): ListedPull[] =>
  numbers.map((number) => ({ number, title: `Pull ${number}`, closes: [] }));

function project(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    name: 'alpha',
    repo: 'me/alpha',
    dashboardUrl: '/p/me/alpha',
    open: 2,
    counts: NO_COUNTS,
    openPulls: pulls(10, 12),
    openIssues: [5, 9],
    ...overrides,
  };
}

const report = (minute: number, projects: ProjectSnapshot[]): ProjectsReport => ({
  generatedAt: `2026-10-03T12:${String(minute).padStart(2, '0')}:00Z`,
  projects,
  directives: [],
});

/** The memory after the first report, which only ever records. */
const after = (first: ProjectsReport): ActivityMemory => compareReport(EMPTY_MEMORY, first).memory;

describe('compareReport', () => {
  it('only records the first report after the page loads', () => {
    const comparison = compareReport(EMPTY_MEMORY, report(0, [project()]));

    expect(comparison.departedPulls).toEqual([]);
    expect(comparison.newIssues).toEqual([]);
  });

  it('only records a repository seen for the first time', () => {
    const memory = after(report(0, [project()]));
    const beta = project({ name: 'beta', repo: 'me/beta', openPulls: pulls(1), openIssues: [2] });

    const comparison = compareReport(memory, report(5, [project(), beta]));
    const next = compareReport(
      comparison.memory,
      report(10, [project(), { ...beta, openPulls: pulls() }]),
    );

    expect(comparison.departedPulls).toEqual([]);
    expect(comparison.newIssues).toEqual([]);
    expect(next.departedPulls).toEqual([{ repo: 'me/beta', label: 'beta', number: 1, closes: [] }]);
  });

  it('finds a pull request that was open and is not now', () => {
    const memory = after(report(0, [project()]));

    const comparison = compareReport(memory, report(5, [project({ openPulls: pulls(12, 13) })]));

    expect(comparison.departedPulls).toEqual([
      { repo: 'me/alpha', label: 'alpha', number: 10, closes: [] },
    ]);
  });

  it('finds an issue numbered above any seen before', () => {
    const memory = after(report(0, [project()]));

    const comparison = compareReport(memory, report(5, [project({ openIssues: [5, 9, 14] })]));

    expect(comparison.newIssues).toEqual([{ repo: 'me/alpha', label: 'alpha', number: 14 }]);
  });

  it('never counts a reopened issue as new', () => {
    const memory = after(report(0, [project({ openIssues: [5, 9] })]));
    const closed = compareReport(memory, report(5, [project({ openIssues: [9] })])).memory;

    const comparison = compareReport(closed, report(10, [project({ openIssues: [5, 9] })]));

    expect(comparison.newIssues).toEqual([]);
  });

  it('counts the pull requests in the numbers seen, as GitHub numbers both in one sequence', () => {
    const memory = after(report(0, [project({ openPulls: pulls(20), openIssues: [5] })]));

    const comparison = compareReport(
      memory,
      report(5, [project({ openPulls: pulls(20), openIssues: [5, 7] })]),
    );

    expect(comparison.newIssues).toEqual([]);
  });

  it('never compares an unreadable project, and keeps its memory for when it recovers', () => {
    const memory = after(report(0, [project()]));
    const unreadable = project({
      error: 'rate limited',
      openPulls: undefined,
      openIssues: undefined,
    });

    const broken = compareReport(memory, report(5, [unreadable]));
    const recovered = compareReport(broken.memory, report(10, [project({ openPulls: pulls(12) })]));

    expect(broken.departedPulls).toEqual([]);
    expect(broken.newIssues).toEqual([]);
    expect(recovered.departedPulls.map((pull) => pull.number)).toEqual([10]);
  });

  it('treats an unknown issue list as unknown, not as none', () => {
    const memory = after(report(0, [project()]));

    const unknown = compareReport(memory, report(5, [project({ openIssues: undefined })]));
    const back = compareReport(unknown.memory, report(10, [project({ openIssues: [5, 9, 13] })]));

    expect(unknown.newIssues).toEqual([]);
    expect(back.newIssues.map((issue) => issue.number)).toEqual([13]);
  });

  it('ignores a report no newer than the last one compared', () => {
    const memory = after(report(5, [project()]));

    const same = compareReport(
      memory,
      report(5, [project({ openPulls: pulls(), openIssues: [99] })]),
    );
    const older = compareReport(
      memory,
      report(1, [project({ openPulls: pulls(), openIssues: [99] })]),
    );

    const unchanged = {
      memory,
      departedPulls: [],
      openedPulls: [],
      newIssues: [],
      departedIssues: [],
    };
    expect(same).toEqual(unchanged);
    expect(older).toEqual(unchanged);
  });

  it('names a project by its repository where two share a display name', () => {
    const twin = project({ repo: 'them/alpha' });
    const memory = after(report(0, [project(), twin]));

    const comparison = compareReport(
      memory,
      report(5, [project(), { ...twin, openIssues: [5, 9, 13] }]),
    );

    expect(comparison.newIssues).toEqual([{ repo: 'them/alpha', label: 'them/alpha', number: 13 }]);
  });

  it('remembers the issues a pull request said it closes, for when it leaves', () => {
    const fix: ListedPull = { number: 12, title: 'Fix', closes: [5, 9] };
    const memory = after(report(0, [project({ openPulls: [fix] })]));

    const comparison = compareReport(memory, report(5, [project({ openPulls: [] })]));

    expect(comparison.departedPulls).toEqual([
      { repo: 'me/alpha', label: 'alpha', number: 12, closes: [5, 9] },
    ]);
  });

  it('finds a pull request numbered above any issue or pull request seen before', () => {
    const memory = after(report(0, [project()]));
    const opened: ListedPull = { number: 13, title: 'Transport bar', closes: [] };

    const comparison = compareReport(
      memory,
      report(5, [project({ openPulls: [...pulls(10, 12), opened] })]),
    );

    expect(comparison.openedPulls).toEqual([
      { repo: 'me/alpha', label: 'alpha', number: 13, title: 'Transport bar' },
    ]);
  });

  it('never counts a reopened pull request, or one numbered below an issue seen, as opened', () => {
    const memory = after(report(0, [project({ openPulls: pulls(10, 12), openIssues: [20] })]));
    const closed = compareReport(memory, report(5, [project({ openPulls: pulls(12) })])).memory;

    const comparison = compareReport(
      closed,
      report(10, [project({ openPulls: pulls(10, 12, 15), openIssues: [20] })]),
    );

    expect(comparison.openedPulls).toEqual([]);
  });

  it('finds no pull request opened in a repository seen for the first time', () => {
    const comparison = compareReport(EMPTY_MEMORY, report(0, [project()]));

    expect(comparison.openedPulls).toEqual([]);
  });

  it('finds an issue that was open and is not now', () => {
    const memory = after(report(0, [project({ openIssues: [5, 9] })]));

    const comparison = compareReport(memory, report(5, [project({ openIssues: [9] })]));

    expect(comparison.departedIssues).toEqual([{ repo: 'me/alpha', label: 'alpha', number: 5 }]);
  });

  it('finds no issue gone while the issue list is unknown, and compares with the last known', () => {
    const memory = after(report(0, [project({ openIssues: [5, 9] })]));

    const unknown = compareReport(memory, report(5, [project({ openIssues: undefined })]));
    const back = compareReport(unknown.memory, report(10, [project({ openIssues: [9] })]));

    expect(unknown.departedIssues).toEqual([]);
    expect(back.departedIssues.map((issue) => issue.number)).toEqual([5]);
  });

  it('finds no issue gone in an unreadable project', () => {
    const memory = after(report(0, [project({ openIssues: [5, 9] })]));
    const unreadable = project({ error: 'down', openPulls: undefined, openIssues: undefined });

    const comparison = compareReport(memory, report(5, [unreadable]));

    expect(comparison.departedIssues).toEqual([]);
  });
});
