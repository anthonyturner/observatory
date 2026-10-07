import { ReleaseTimeline, UNRELEASED_KEY } from '../../../core/releases/release-timeline';
import { Release, ShippedPull } from '../../../core/releases/releases-report';
import { releaseRows } from '../release-list/release-list';
import { detailOf, firstPick } from './release-detail-view';

const pull = (number: number, mergedAt: Date): ShippedPull => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/app/pull/${number}`,
  mergedAt: mergedAt.getTime(),
  author: 'me',
});

const V1: Release = {
  tag: 'v1.0.0',
  name: 'v1.0.0',
  publishedAt: new Date(2026, 8, 1).getTime(),
  url: 'https://github.com/me/app/releases/tag/v1.0.0',
  isPrerelease: false,
  notes: { source: 'changelog', markdown: '- First.' },
  pulls: [pull(1, new Date(2026, 7, 30))],
};

const OLD_WEEK = {
  key: '2026-09-21',
  start: new Date(2026, 8, 21).getTime(),
  pulls: [pull(5, new Date(2026, 8, 22))],
};
const NEW_WEEK = {
  key: '2026-09-28',
  start: new Date(2026, 8, 28).getTime(),
  pulls: [pull(9, new Date(2026, 8, 29))],
};

const TIMELINE: ReleaseTimeline = {
  releases: [{ release: V1, bump: 'major' }],
  unreleased: {
    notes: null,
    pulls: [...NEW_WEEK.pulls, ...OLD_WEEK.pulls],
    weeks: [OLD_WEEK, NEW_WEEK],
  },
};

describe('detailOf', () => {
  it('shows a release with its kind, changelog notes and linked pull requests', () => {
    const detail = detailOf(TIMELINE, 'v1.0.0');

    expect(detail?.kind).toBe('Major release');
    expect(detail?.url).toBe(V1.url);
    expect(detail?.notesHeading).toBe('From CHANGELOG.md');
    expect(detail?.meta).toContain('1 merged pull request');
    expect(detail?.groups[0].rows[0]).toEqual(
      expect.objectContaining({ number: 1, url: 'https://github.com/me/app/pull/1' }),
    );
  });

  it('shows the unreleased work by week, newest week first', () => {
    const detail = detailOf(TIMELINE, UNRELEASED_KEY);

    expect(detail?.title).toBe('Unreleased');
    expect(detail?.url).toBeNull();
    expect(detail?.groups.map((group) => group.key)).toEqual(['2026-09-28', '2026-09-21']);
    expect(detail?.groups[0].heading).toContain('· 1');
  });

  it('names nothing for a key the timeline does not hold', () => {
    expect(detailOf(TIMELINE, 'v9')).toBeNull();
    expect(detailOf({ releases: [], unreleased: null }, UNRELEASED_KEY)).toBeNull();
  });
});

describe('firstPick', () => {
  it('opens on the unreleased work, else the newest release', () => {
    expect(firstPick(TIMELINE)).toBe(UNRELEASED_KEY);
    expect(firstPick({ ...TIMELINE, unreleased: null })).toBe('v1.0.0');
    expect(firstPick({ releases: [], unreleased: null })).toBeNull();
  });
});

describe('releaseRows', () => {
  it('lists the unreleased work on top, then the releases newest first', () => {
    const rows = releaseRows(TIMELINE);

    expect(rows.map((row) => [row.key, row.ink, row.count])).toEqual([
      [UNRELEASED_KEY, 'comet', '2 merged pull requests'],
      ['v1.0.0', 'major', '1 merged pull request'],
    ]);
  });
});
