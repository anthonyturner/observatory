import { bumpOf, releaseTimeline, weekStartOf, weeksOf } from './release-timeline';
import { Release, ReleasesReport, ShippedPull } from './releases-report';

const pull = (number: number, mergedAt: Date): ShippedPull => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/app/pull/${number}`,
  mergedAt: mergedAt.getTime(),
  author: 'me',
});

const release = (tag: string, publishedAt: Date): Release => ({
  tag,
  name: tag,
  publishedAt: publishedAt.getTime(),
  url: `https://github.com/me/app/releases/tag/${tag}`,
  isPrerelease: false,
  notes: null,
  pulls: [],
});

const report = (releases: Release[], pulls: ShippedPull[]): ReleasesReport => ({
  generatedAt: 0,
  repo: 'me/app',
  source: releases.length ? 'releases' : 'none',
  releases,
  unreleased: { notes: null, pulls },
});

describe('bumpOf', () => {
  it('reads how far the version moved from the release before', () => {
    expect(bumpOf('v1.0.0', null)).toBe('major');
    expect(bumpOf('v2.0.0', 'v1.4.2')).toBe('major');
    expect(bumpOf('1.5.0', 'v1.4.2')).toBe('minor');
    expect(bumpOf('v1.4.3', 'v1.4.2')).toBe('patch');
    expect(bumpOf('v1.4', 'v1.4.0-rc.1')).toBe('patch');
  });

  it('calls a tag that is no version, or follows one, other', () => {
    expect(bumpOf('spring-launch', null)).toBe('other');
    expect(bumpOf('v1.0.0', 'nightly')).toBe('other');
  });
});

describe('weeksOf', () => {
  it('groups merges by the local week, Monday first, oldest week first', () => {
    const sunday = new Date(2026, 9, 4, 23, 0);
    const monday = new Date(2026, 9, 5, 0, 30);
    const wednesday = new Date(2026, 9, 7, 12, 0);

    const weeks = weeksOf([pull(1, sunday), pull(2, monday), pull(3, wednesday)]);

    expect(weeks.map((week) => [week.key, week.pulls.map((each) => each.number)])).toEqual([
      ['2026-09-28', [1]],
      ['2026-10-05', [3, 2]],
    ]);
    expect(weeks[1].start).toBe(new Date(2026, 9, 5).getTime());
  });

  it('starts a Monday’s own week on that Monday', () => {
    expect(weekStartOf(new Date(2026, 9, 5, 9).getTime())).toEqual(new Date(2026, 9, 5));
  });
});

describe('releaseTimeline', () => {
  it('runs the releases oldest first, each with its bump, and the work since', () => {
    const timeline = releaseTimeline(
      report(
        [release('v1.1.0', new Date(2026, 2, 1)), release('v1.0.0', new Date(2026, 0, 1))],
        [pull(9, new Date(2026, 3, 1))],
      ),
    );

    expect(timeline.releases.map((each) => [each.release.tag, each.bump])).toEqual([
      ['v1.0.0', 'major'],
      ['v1.1.0', 'minor'],
    ]);
    expect(timeline.unreleased?.weeks.length).toBe(1);
  });

  it('has no unreleased work when nothing merged since and the changelog lists nothing', () => {
    expect(
      releaseTimeline(report([release('v1', new Date(2026, 0, 1))], [])).unreleased,
    ).toBeNull();
  });
});
