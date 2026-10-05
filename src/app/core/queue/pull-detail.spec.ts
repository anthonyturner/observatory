import { parsePullDetail } from './pull-detail';

const detail = {
  number: 58,
  title: 'Replace the facade',
  body: '<script>alert(1)</script> Closes #57',
  bodyTruncated: false,
  url: 'https://github.com/me/a/pull/58',
  state: 'merged',
  isDraft: true,
  mergeable: 'CONFLICTING',
  bucket: 'conflicted',
  author: 'anthony',
  head: 'refactor/57',
  base: 'main',
  headOid: 'b2b767f94b7a8acb0e88d0cc7ec9c3023b0329be',
  labels: [{ name: 'area:dashboard', color: '1d76db' }, { name: 7 }],
  assignees: ['anthony'],
  closes: [57],
  checks: [
    {
      name: 'CI / Test',
      run: 'Test',
      outcome: 'failed',
      result: 'FAILURE',
      url: 'https://github.com/x/2',
    },
    { name: 'deploy', outcome: 'pending', url: 'javascript:alert(1)' },
  ],
  reviewDecision: 'changes-requested',
  requestedReviewers: ['sam'],
  reviews: [{ reviewer: 'kim', state: 'changes requested' }],
  additions: 96,
  deletions: 95,
  changedFiles: 4,
  files: [{ path: 'src/a.ts', additions: 90, deletions: 95, change: 'MODIFIED' }, { path: 3 }],
  commits: [
    { oid: '5f0d0cc', headline: 'chore: start', date: '2026-07-30T05:00:00Z', authors: ['a'] },
  ],
  commitsTotal: 1,
  diff: 'diff --git a/src/a.ts b/src/a.ts\n',
  diffBytes: 33,
  diffTruncated: true,
  createdAt: '2026-07-30T05:16:37Z',
  updatedAt: '2026-07-30T05:16:46Z',
  fetchedAt: '2026-09-26T10:00:00Z',
};

describe('parsePullDetail', () => {
  it('keeps the details, the body as the text it is', () => {
    const parsed = parsePullDetail(detail);

    expect(parsed?.body).toBe('<script>alert(1)</script> Closes #57');
    expect(parsed?.checks[0]).toEqual({ run: 'Test', result: 'FAILURE' });
  });

  it('keeps what the PR screen’s tabs show, dropping entries that do not parse', () => {
    const parsed = parsePullDetail(detail);

    expect(parsed?.labels).toEqual([{ name: 'area:dashboard', color: '1d76db' }]);
    expect(parsed?.files).toEqual([
      { path: 'src/a.ts', additions: 90, deletions: 95, change: 'MODIFIED' },
    ]);
    expect(parsed?.commits).toEqual(detail.commits);
    expect([parsed?.headOid, parsed?.mergeable, parsed?.diffTruncated]).toEqual([
      detail.headOid,
      'CONFLICTING',
      true,
    ]);
    expect(parsed?.fetchedAt).toBe(detail.fetchedAt);
  });

  it('keeps its state and review decision, reading unknown words as open and none', () => {
    const parsed = parsePullDetail(detail);
    expect([parsed?.state, parsed?.reviewDecision]).toEqual(['merged', 'changes-requested']);

    const odd = parsePullDetail({ ...detail, state: 'LOCKED', reviewDecision: 7 });
    expect([odd?.state, odd?.reviewDecision]).toEqual(['open', 'none']);
  });

  it('names a check by its name when it has no run, and reads no result as pending', () => {
    expect(parsePullDetail(detail)?.checks[1]).toEqual({ run: 'deploy', result: 'PENDING' });
  });

  it('refuses a pull request that is not on GitHub, or not a pull request', () => {
    expect(parsePullDetail({ ...detail, url: 'https://evil.example/pull/1' })).toBeNull();
    expect(parsePullDetail({ error: 'number must be a pull request number' })).toBeNull();
  });

  it('reads missing or malformed fields as empty, and code as shown unless withheld', () => {
    const bare = parsePullDetail({ ...detail, mergeable: 5, files: null });
    expect(bare?.mergeable).toBe('UNKNOWN');
    expect(bare?.diffHidden).toBe(false);
    expect(parsePullDetail({ ...detail, diffHidden: true })?.diffHidden).toBe(true);
    expect(bare?.files).toEqual([]);
  });
});
