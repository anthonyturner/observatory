import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileTextOf, readChangelog } from './changelog-reader.ts';

const encoded = (text: string) => ({
  encoding: 'base64',
  content: Buffer.from(text, 'utf8').toString('base64'),
});

describe('fileTextOf', () => {
  it('decodes a file GitHub sent as base64, and reads anything else as none', () => {
    assert.equal(fileTextOf(encoded('# Changelog — ünïcode')), '# Changelog — ünïcode');
    assert.equal(fileTextOf({ encoding: 'none', content: '' }), null);
    assert.equal(fileTextOf([]), null);
  });
});

describe('readChangelog', () => {
  it('reads CHANGELOG.md from the repository’s contents', async () => {
    const asked: string[] = [];
    const text = await readChangelog(async (path) => {
      asked.push(path);
      return encoded('## [Unreleased]');
    }, 'me/app');

    assert.deepEqual(asked, ['repos/me/app/contents/CHANGELOG.md']);
    assert.equal(text, '## [Unreleased]');
  });

  it('answers none for a repository without one, from either reader', async () => {
    for (const message of [
      'gh: Not Found (HTTP 404)',
      'GitHub: HTTP 404 {"message":"Not Found"}',
    ]) {
      assert.equal(
        await readChangelog(async () => {
          throw new Error(message);
        }, 'me/app'),
        null,
      );
    }
  });

  it('passes any other failure on', async () => {
    await assert.rejects(
      readChangelog(async () => {
        throw new Error('GitHub: HTTP 401 Bad credentials');
      }, 'me/app'),
      /401/,
    );
  });
});
