import { PullDetail } from '../../../core/queue/pull-detail';
import { checkRows, commitRows, commitsNote, fileRows } from './sheet-rows/sheet-row';
import { kickerOf, labelColour, resultClass, routeOf, tabCounts } from './sheet-view';

const detail = {
  number: 572,
  base: 'main',
  head: 'fix/569',
  state: 'open',
  isDraft: true,
  mergeable: 'MERGEABLE',
  additions: 144,
  deletions: 3,
  changedFiles: 3,
  fetchedAt: '2026-09-26T04:48:07Z',
  files: [{ path: 'a.sql', additions: 18, deletions: 0, change: 'ADDED' }],
  commits: [
    { oid: '5f0d0cc', headline: 'first', date: '2026-09-24T08:57:06Z', authors: [] },
    { oid: '5645cda', headline: 'second', date: '2026-09-24T09:02:45Z', authors: [] },
  ],
  commitsTotal: 2,
  checks: [
    { name: 'lint', run: 'lint', outcome: 'failed', result: 'FAILURE', url: null },
    { name: 'deploy', run: 'deploy', outcome: 'pending', result: 'IN_PROGRESS', url: null },
    { name: 'test', run: 'test', outcome: 'passed', result: 'SUCCESS', url: null },
  ],
} as unknown as PullDetail;

describe('the PR screen’s view', () => {
  it('counts files, commits and failed checks for the tabs', () => {
    expect(tabCounts(detail)).toEqual({
      overview: '',
      files: '3',
      commits: '2',
      checks: '1✕ 3',
      diff: '',
      edit: '',
    });
    expect(tabCounts({ ...detail, checks: [] }).checks).toBe('');
  });

  it('words the route line as pr-starmap does', () => {
    const route = routeOf(detail, 'en-US');
    expect(route).toEqual({
      base: 'main',
      head: 'fix/569',
      state: 'draft',
      mergeable: 'mergeable',
      mergeClass: 'ok',
      additions: '+144',
      deletions: '−3',
      fetched: `fetched ${new Date(detail.fetchedAt).toLocaleString('en-US')}`,
    });
    expect(routeOf({ ...detail, isDraft: false, mergeable: 'UNKNOWN' }).state).toBe(
      'ready for review',
    );
    expect(routeOf({ ...detail, state: 'merged' }).state).toBe('merged');
    expect(routeOf({ ...detail, mergeable: 'CONFLICTING' }).mergeClass).toBe('bad');
    expect(routeOf({ ...detail, mergeable: 'UNKNOWN' }).mergeClass).toBe('meh');
  });

  it('names the bucket by its star', () => {
    expect(kickerOf('unlinked')).toBe('Vagrans — no issue linked');
  });

  it('colours a label by GitHub’s hex, else grey', () => {
    expect(labelColour('d73a4a')).toBe('#d73a4a');
    expect(labelColour('red;background:url(x)')).toBe('var(--muted)');
  });

  it('colours a check by its result', () => {
    expect(['SUCCESS', 'SKIPPED', 'TIMED_OUT', 'QUEUED'].map(resultClass)).toEqual([
      'ok',
      'ok',
      'bad',
      'meh',
    ]);
  });
});

describe('the PR screen’s rows', () => {
  it('lists files with what changed and by how much', () => {
    expect(fileRows(detail)[0].cells.map((cell) => cell.text)).toEqual([
      'a.sql',
      'added',
      '+18',
      '−0',
    ]);
  });

  it('lists commits newest first', () => {
    expect(commitRows(detail, 'en-US').map((row) => row.cells[1].text)).toEqual([
      'second',
      'first',
    ]);
    expect(commitsNote(detail)).toBeNull();
    expect(commitsNote({ ...detail, commitsTotal: 60 })).toBe('Showing the latest 2 of 60.');
  });

  it('lists checks with their result in lower case', () => {
    expect(checkRows(detail).map((row) => row.cells[1])).toEqual([
      { text: 'failure', classes: 'mono bad' },
      { text: 'in_progress', classes: 'mono meh' },
      { text: 'success', classes: 'mono ok' },
    ]);
  });
});
