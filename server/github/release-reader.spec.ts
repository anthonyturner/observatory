import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commitDateOf, readReleases, readTags, releasesOf, taggedCommitsOf } from './release-reader.ts';

const release = (tag: string, publishedAt: string | null, extra: object = {}) => ({
  tag_name: tag,
  name: `Release ${tag}`,
  published_at: publishedAt,
  html_url: `https://github.com/me/app/releases/tag/${tag}`,
  prerelease: false,
  draft: false,
  body: `Notes for ${tag}`,
  ...extra,
});

describe('releasesOf', () => {
  it('keeps published releases, newest first, and leaves drafts out', () => {
    const marks = releasesOf([
      release('v1.0.0', '2026-01-01T00:00:00Z'),
      release('v1.2.0', '2026-03-01T00:00:00Z', { prerelease: true }),
      release('v1.1.0', null, { draft: true }),
      release('v1.1.1', '2026-02-01T00:00:00Z', { draft: true }),
    ]);

    assert.deepEqual(
      marks.map((mark) => [mark.tag, mark.isPrerelease]),
      [
        ['v1.2.0', true],
        ['v1.0.0', false],
      ],
    );
    assert.equal(marks[0].name, 'Release v1.2.0');
    assert.equal(marks[0].body, 'Notes for v1.2.0');
  });

  it('names an untitled release by its tag and reads anything else as none', () => {
    assert.equal(releasesOf([release('v2', '2026-01-01T00:00:00Z', { name: null })])[0].name, 'v2');
    assert.deepEqual(releasesOf({ message: 'Not Found' }), []);
  });
});

describe('taggedCommitsOf and commitDateOf', () => {
  it('reads each tag’s commit and a commit’s date', () => {
    assert.deepEqual(taggedCommitsOf([{ name: 'v1', commit: { sha: 'abc' } }, { name: 'v2' }]), [
      { name: 'v1', sha: 'abc' },
    ]);
    assert.equal(
      commitDateOf({ commit: { committer: { date: '2026-01-01T00:00:00Z' } } }),
      '2026-01-01T00:00:00Z',
    );
    assert.equal(commitDateOf({}), null);
  });
});

describe('readReleases and readTags', () => {
  it('asks for one page of releases, no larger than the limit', async () => {
    const asked: string[] = [];
    const marks = await readReleases(
      async (path) => {
        asked.push(path);
        return [release('v1', '2026-01-01T00:00:00Z'), release('v2', '2026-02-01T00:00:00Z')];
      },
      'me/app',
      1,
    );

    assert.deepEqual(asked, ['repos/me/app/releases?per_page=1']);
    assert.deepEqual(
      marks.map((mark) => mark.tag),
      ['v2'],
    );
  });

  it('dates each tag by its commit, newest first, and drops one it cannot date', async () => {
    const dates: Record<string, string> = { a: '2026-01-01T00:00:00Z', b: '2026-02-01T00:00:00Z' };
    const marks = await readTags(
      async (path) => {
        if (path.includes('/tags')) {
          return [
            { name: 'v1', commit: { sha: 'a' } },
            { name: 'v2', commit: { sha: 'b' } },
            { name: 'v3', commit: { sha: 'c' } },
          ];
        }
        const sha = path.split('/').at(-1) ?? '';
        return { commit: { committer: { date: dates[sha] } } };
      },
      'me/app',
      10,
    );

    assert.deepEqual(
      marks.map((mark) => [mark.tag, mark.url, mark.body]),
      [
        ['v2', 'https://github.com/me/app/tree/v2', ''],
        ['v1', 'https://github.com/me/app/tree/v1', ''],
      ],
    );
  });
});
