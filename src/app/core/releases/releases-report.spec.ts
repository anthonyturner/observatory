import { parseReleasesReport } from './releases-report';

const PULL = {
  number: 7,
  title: 'Add a thing',
  url: 'https://github.com/me/app/pull/7',
  mergedAt: '2026-10-01T10:00:00Z',
  author: 'me',
};

describe('parseReleasesReport', () => {
  it('reads a report, times as milliseconds', () => {
    const report = parseReleasesReport({
      generatedAt: '2026-10-07T00:00:00Z',
      repo: 'me/app',
      source: 'releases',
      releases: [
        {
          tag: 'v1.0.0',
          name: 'First',
          publishedAt: '2026-10-02T00:00:00Z',
          url: 'https://github.com/me/app/releases/tag/v1.0.0',
          isPrerelease: true,
          notes: { source: 'changelog', markdown: '- First.' },
          pulls: [PULL],
        },
      ],
      unreleased: { notes: null, pulls: [] },
    });

    expect(report?.releases[0]).toEqual({
      tag: 'v1.0.0',
      name: 'First',
      publishedAt: Date.parse('2026-10-02T00:00:00Z'),
      url: 'https://github.com/me/app/releases/tag/v1.0.0',
      isPrerelease: true,
      notes: { source: 'changelog', markdown: '- First.' },
      pulls: [{ ...PULL, mergedAt: Date.parse(PULL.mergedAt) }],
    });
    expect(report?.generatedAt).toBe(Date.parse('2026-10-07T00:00:00Z'));
  });

  it('drops a pull request or release out of shape, and any link that is not https', () => {
    const report = parseReleasesReport({
      generatedAt: '2026-10-07T00:00:00Z',
      repo: 'me/app',
      source: 'none',
      releases: [{ tag: 'v1', publishedAt: 'never', url: 'https://x' }],
      unreleased: {
        notes: { source: 'wiki', markdown: 'x' },
        pulls: [PULL, { ...PULL, url: 'javascript:alert(1)' }, { ...PULL, number: 'eight' }],
      },
    });

    expect(report?.releases).toEqual([]);
    expect(report?.unreleased.notes).toBeNull();
    expect(report?.unreleased.pulls.map((pull) => pull.number)).toEqual([7]);
  });

  it('reads anything else as no report', () => {
    expect(parseReleasesReport(null)).toBeNull();
    expect(parseReleasesReport({ repo: 'me/app', source: 'sometimes' })).toBeNull();
    expect(parseReleasesReport({ repo: 'me/app', source: 'none', generatedAt: 'x' })).toBeNull();
  });
});
