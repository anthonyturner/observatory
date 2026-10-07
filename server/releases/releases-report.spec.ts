import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MergedPull } from '../github/merged-pull-reader.ts';
import type { ReleaseMark } from '../github/release-reader.ts';
import {
  RELEASE_LIMIT,
  type ReleaseSources,
  notesFor,
  releaseEntries,
  releasesReport,
  shippedIn,
} from './releases-report.ts';

const mark = (tag: string, publishedAt: string, extra: Partial<ReleaseMark> = {}): ReleaseMark => ({
  tag,
  name: tag,
  publishedAt,
  url: `https://github.com/me/app/releases/tag/${tag}`,
  isPrerelease: false,
  body: '',
  ...extra,
});

const pull = (number: number, mergedAt: string): MergedPull => ({
  number,
  title: `Change ${number}`,
  url: `https://github.com/me/app/pull/${number}`,
  mergedAt,
  author: 'me',
});

const V1 = mark('v1.0.0', '2026-01-10T00:00:00Z');
const V2 = mark('v1.1.0', '2026-02-10T00:00:00Z');

describe('shippedIn', () => {
  it('gives each pull request to the first release published at or after its merge', () => {
    const shipped = shippedIn(
      [V2, V1],
      [
        pull(1, '2026-01-05T00:00:00Z'),
        pull(2, '2026-01-10T00:00:00Z'),
        pull(3, '2026-01-20T00:00:00Z'),
        pull(4, '2026-03-01T00:00:00Z'),
      ],
    );

    assert.deepEqual(
      shipped.byTag.get('v1.0.0')?.map((each) => each.number),
      [1, 2],
    );
    assert.deepEqual(
      shipped.byTag.get('v1.1.0')?.map((each) => each.number),
      [3],
    );
    assert.deepEqual(
      shipped.unreleased.map((each) => each.number),
      [4],
    );
  });

  it('counts everything as unreleased when nothing has been released', () => {
    const shipped = shippedIn([], [pull(1, '2026-01-05T00:00:00Z')]);

    assert.equal(shipped.unreleased.length, 1);
    assert.equal(shipped.byTag.size, 0);
  });
});

describe('notesFor', () => {
  const sections = new Map([
    ['1.0.0', '- First.'],
    ['spring', '- Named.'],
  ]);

  it('takes the changelog section under the tag or the title', () => {
    assert.deepEqual(notesFor(V1, sections), { source: 'changelog', markdown: '- First.' });
    assert.deepEqual(notesFor(mark('r7', V2.publishedAt, { name: 'Spring' }), sections), {
      source: 'changelog',
      markdown: '- Named.',
    });
  });

  it('falls back to the release body, then to none', () => {
    assert.deepEqual(notesFor({ ...V2, body: '  * Fix  ' }, sections), {
      source: 'release',
      markdown: '* Fix',
    });
    assert.equal(notesFor(V2, sections), null);
  });
});

describe('releaseEntries', () => {
  it('lists releases newest first with their notes, and the unreleased changelog entries', () => {
    const { releases, unreleased } = releaseEntries(
      [V1, V2],
      [pull(1, '2026-01-05T00:00:00Z'), pull(9, '2026-03-05T00:00:00Z')],
      '## [Unreleased]\n\n- Next.\n\n## [1.0.0]\n\n- First.',
    );

    assert.deepEqual(
      releases.map((release) => [release.tag, release.pulls.length, release.notes?.source ?? null]),
      [
        ['v1.1.0', 0, null],
        ['v1.0.0', 1, 'changelog'],
      ],
    );
    assert.deepEqual(unreleased.notes, { source: 'changelog', markdown: '- Next.' });
    assert.deepEqual(
      unreleased.pulls.map((each) => each.number),
      [9],
    );
  });

  it('reads one release past the limit only as where the oldest shown one begins', () => {
    const marks = Array.from({ length: RELEASE_LIMIT + 1 }, (_, index) =>
      mark(`v${index}`, new Date(Date.UTC(2026, 0, index + 1)).toISOString()),
    );
    const early = pull(1, '2025-06-01T00:00:00Z');
    const { releases } = releaseEntries(marks, [early], null);

    assert.equal(releases.length, RELEASE_LIMIT);
    assert.equal(releases.at(-1)?.tag, 'v1');
    assert.equal(releases.at(-1)?.pulls.length, 0);
  });
});

describe('releasesReport', () => {
  const sources = (releases: ReleaseMark[], tags: ReleaseMark[]): ReleaseSources => ({
    releases: async () => releases,
    tags: async () => tags,
    changelog: async () => null,
    mergedPulls: async () => [pull(1, '2026-01-05T00:00:00Z')],
  });

  it('reads releases where there are any', async () => {
    const report = await releasesReport(sources([V1], [V2]), 'me/app', Date.UTC(2026, 3, 1));

    assert.equal(report.source, 'releases');
    assert.equal(report.repo, 'me/app');
    assert.equal(report.generatedAt, '2026-04-01T00:00:00.000Z');
    assert.deepEqual(
      report.releases.map((release) => release.tag),
      ['v1.0.0'],
    );
  });

  it('falls back to tags, and to none', async () => {
    assert.equal((await releasesReport(sources([], [V2]), 'me/app')).source, 'tags');
    const none = await releasesReport(sources([], []), 'me/app');

    assert.equal(none.source, 'none');
    assert.deepEqual(none.releases, []);
    assert.equal(none.unreleased.pulls.length, 1);
  });
});
