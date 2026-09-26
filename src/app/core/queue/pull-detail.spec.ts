import { parsePullDetail } from './pull-detail';

const detail = {
  number: 58,
  title: 'Replace the facade',
  body: '<script>alert(1)</script> Closes #57',
  url: 'https://github.com/me/a/pull/58',
  isDraft: true,
  bucket: 'conflicted',
  author: 'anthony',
  head: 'refactor/57',
  base: 'main',
  labels: ['area:dashboard'],
  closes: [57],
  checks: [
    { name: 'CI / Test', outcome: 'failed', url: 'https://github.com/x/2' },
    { name: 'deploy', outcome: 'pending', url: 'javascript:alert(1)' },
  ],
  reviewDecision: 'changes-requested',
  requestedReviewers: ['sam'],
  reviews: [{ reviewer: 'kim', state: 'changes requested' }],
  additions: 96,
  deletions: 95,
  changedFiles: 4,
  createdAt: '2026-07-30T05:16:37Z',
  updatedAt: '2026-07-30T05:16:46Z',
};

describe('parsePullDetail', () => {
  it('keeps the details, the body as the text it is', () => {
    const parsed = parsePullDetail(detail);

    expect(parsed?.body).toBe('<script>alert(1)</script> Closes #57');
    expect(parsed?.checks[0]).toEqual({
      name: 'CI / Test',
      outcome: 'failed',
      url: 'https://github.com/x/2',
    });
    expect(parsed?.reviewDecision).toBe('changes-requested');
  });

  it('drops a check link that is not https', () => {
    expect(parsePullDetail(detail)?.checks[1].url).toBeNull();
  });

  it('refuses a pull request that is not on GitHub, or not a pull request', () => {
    expect(parsePullDetail({ ...detail, url: 'https://evil.example/pull/1' })).toBeNull();
    expect(parsePullDetail({ error: 'number must be a pull request number' })).toBeNull();
  });

  it('reads an unknown review decision as none', () => {
    expect(parsePullDetail({ ...detail, reviewDecision: 'MAYBE' })?.reviewDecision).toBe('none');
  });
});
