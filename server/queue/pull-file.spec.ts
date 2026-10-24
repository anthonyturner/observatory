import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FileRead } from '../github/docs-reader.ts';
import { BadRequest } from '../http/api-handler.ts';
import {
  type PullFileSources,
  patchOfFile,
  pullFileOf,
  pullFileRequestFrom,
  hiddenPullFile,
} from './pull-file.ts';

const SHA = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const AT = '2026-10-24T09:00:00.000Z';
const request = { repo: 'me/app', number: 7, sha: SHA, path: 'src/a b.ts' };

const DIFF = [
  'diff --git a/README.md b/README.md',
  '@@ -1 +1 @@',
  '-old',
  '+new',
  'diff --git a/src/old.ts b/src/a b.ts',
  'similarity index 90%',
  'rename from src/old.ts',
  'rename to src/a b.ts',
  '@@ -1 +1 @@',
  '-one',
  '+two',
  'diff --git a/lib/src/a b.ts b/lib/src/a b.ts',
  '@@ -1 +1 @@',
  '-x',
  '+y',
  '',
].join('\n');

function sources(
  read: FileRead,
  patch: string | null = 'PATCH',
): PullFileSources & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    heads: async () => ({ base: 'release/1', headOid: HEAD }),
    file: async (...args) => {
      asked.push(`file ${args.join(' ')}`);
      return read;
    },
    patch: async (...args) => {
      asked.push(`patch ${args.join(' ')}`);
      return patch;
    },
  };
}

const found = (text: string | Buffer): FileRead => ({
  kind: 'found',
  bytes: typeof text === 'string' ? Buffer.from(text) : text,
});

describe('patchOfFile', () => {
  it('cuts out the section whose new path is the file, even for a rename', () => {
    assert.equal(patchOfFile(DIFF, 'src/a b.ts'), DIFF.split('\n').slice(4, 11).join('\n') + '\n');
    assert.match(patchOfFile(DIFF, 'README.md'), /^diff --git a\/README.md b\/README.md\n/);
  });

  it('does not take a file named for part of another header for the file it ends with', () => {
    const shadowed = [
      'diff --git a/x b/y b/x b/y',
      '@@ -1 +1 @@',
      '-no',
      '+no',
      'diff --git a/y b/y',
      '@@ -1 +1 @@',
      '-yes',
      '+yes',
      '',
    ].join('\n');

    assert.equal(patchOfFile(shadowed, 'y'), shadowed.split('\n').slice(4).join('\n'));
    assert.equal(
      patchOfFile(shadowed, 'x b/y'),
      shadowed.split('\n').slice(0, 4).join('\n') + '\n',
    );
    assert.equal(patchOfFile(shadowed.split('\n').slice(0, 4).join('\n') + '\n', 'y'), '');
  });

  it('is empty for a file the diff does not change, or one it names only as the old path', () => {
    assert.equal(patchOfFile(DIFF, 'src/old.ts'), '');
    assert.equal(patchOfFile(DIFF, 'a b.ts'), '');
    assert.equal(patchOfFile('', 'README.md'), '');
  });
});

describe('pullFileRequestFrom', () => {
  const query = (text: string): URLSearchParams => new URLSearchParams(text);

  it('reads the number, a lower-case hash and the path', () => {
    assert.deepEqual(
      pullFileRequestFrom('me/app', query(`number=7&sha=${SHA.toUpperCase()}&path=src/a.ts`)),
      { repo: 'me/app', number: 7, sha: SHA, path: 'src/a.ts' },
    );
  });

  it('refuses what is not a pull request number, a commit or a path inside the repository', () => {
    for (const text of [
      `sha=${SHA}&path=a.ts`,
      `number=0&sha=${SHA}&path=a.ts`,
      `number=7&sha=--x&path=a.ts`,
      `number=7&sha=${SHA.slice(0, 7)}&path=a.ts`,
      `number=7&sha=${SHA}`,
      `number=7&sha=${SHA}&path=a/../b.ts`,
    ]) {
      assert.throws(() => pullFileRequestFrom('me/app', query(text)), BadRequest, text);
    }
  });
});

describe('pullFileOf', () => {
  it('carries the text and its changes, both from the commit asked for', async () => {
    const source = sources(found('one\ntwo\n'));

    const file = await pullFileOf(source, request, AT);

    assert.deepEqual(file, {
      path: 'src/a b.ts',
      sha: SHA,
      headOid: HEAD,
      state: 'shown',
      text: 'one\ntwo\n',
      bytes: 8,
      patch: 'PATCH',
      changesUnavailable: false,
      githubUrl: `https://github.com/me/app/blob/${SHA}/src/a%20b.ts`,
      fetchedAt: AT,
    });
    assert.deepEqual(source.asked, [
      `file me/app src/a b.ts ${SHA}`,
      `patch me/app release/1 ${SHA} src/a b.ts`,
    ]);
  });

  it('says the changes are unavailable, not absent, when GitHub would not give them', async () => {
    const file = await pullFileOf(sources(found('a\n'), null), request, AT);

    assert.deepEqual([file.state, file.patch, file.changesUnavailable], ['shown', '', true]);
  });

  it('says a file over the limit is too large, with its size, and reads no changes', async () => {
    const source = sources({ kind: 'too-large', size: 2_000_000 });

    const file = await pullFileOf(source, request, AT);

    assert.deepEqual(
      [file.state, file.bytes, file.text, file.patch],
      ['too-large', 2_000_000, '', ''],
    );
    assert.match(file.githubUrl, /\/blob\//);
    assert.equal(source.asked.length, 1);
  });

  it('says a file with a NUL byte is binary, and sends none of it', async () => {
    const file = await pullFileOf(
      sources(found(Buffer.from([0x89, 0x50, 0x00, 0x47]))),
      request,
      AT,
    );

    assert.deepEqual([file.state, file.bytes, file.text, file.patch], ['binary', 4, '', '']);
  });

  it('points at the pull request when the file is not there at the commit', async () => {
    const source = sources({ kind: 'missing' });

    const file = await pullFileOf(source, request, AT);

    assert.deepEqual([file.state, file.githubUrl], ['missing', 'https://github.com/me/app/pull/7']);
    assert.equal(file.headOid, HEAD);
    assert.equal(source.asked.length, 1);
  });
});

describe('hiddenPullFile', () => {
  it('says the same of a file whatever is there, and carries nothing of it', async () => {
    const hidden = hiddenPullFile(request, AT);

    assert.deepEqual(hidden, {
      path: 'src/a b.ts',
      sha: SHA,
      headOid: SHA,
      state: 'hidden',
      text: '',
      bytes: 0,
      patch: '',
      changesUnavailable: false,
      githubUrl: 'https://github.com/me/app/pull/7',
      fetchedAt: AT,
    });
  });
});
