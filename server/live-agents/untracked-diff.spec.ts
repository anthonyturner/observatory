import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { readOnlyGit } from './read-only-git.ts';
import { origin, recording, write } from './testing/temp-repo.ts';
import {
  UNTRACKED_FILES_CAP,
  UNTRACKED_FILE_LIMIT_BYTES,
  untrackedDiff,
} from './untracked-diff.ts';

const BINARY = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03, 0xfe, 0xff]);

describe('untrackedDiff', () => {
  it('diffs each new file from nothing, leaving out large ones and ignored ones', async () => {
    const repo = origin();
    write(repo, '.gitignore', 'ignored.txt\n');
    write(repo, 'ignored.txt', 'ignored\n');
    write(repo, 'src/new.ts', 'export const a = 1;\n');
    write(repo, 'huge.log', 'y'.repeat(UNTRACKED_FILE_LIMIT_BYTES + 1));

    const found = await untrackedDiff(readOnlyGit(), repo);

    assert.match(found.diff, /^diff --git a\/src\/new\.ts b\/src\/new\.ts$/m);
    assert.match(found.diff, /^--- \/dev\/null$/m);
    assert.match(found.diff, /^\+export const a = 1;$/m);
    assert.doesNotMatch(found.diff, /^diff --git a\/(ignored\.txt|huge\.log) /m);
    assert.deepEqual(found.skippedLarge, ['huge.log']);
    assert.equal(found.overCap, 0);
  });

  it('lists a binary file without sending any of its contents', async () => {
    const repo = origin();
    write(repo, 'logo.png', BINARY);

    const found = await untrackedDiff(readOnlyGit(), repo);

    assert.match(found.diff, /^diff --git a\/logo\.png b\/logo\.png$/m);
    assert.match(found.diff, /^Binary files \/dev\/null and b\/logo\.png differ$/m);
    assert.ok(!found.diff.includes('PNG'));
  });

  it(`reads at most ${UNTRACKED_FILES_CAP} files and counts the rest`, async () => {
    const repo = origin();
    for (let index = 0; index < UNTRACKED_FILES_CAP + 5; index++) {
      write(repo, `many/${String(index).padStart(3, '0')}.txt`, `${index}\n`);
    }

    const found = await untrackedDiff(readOnlyGit(), repo);

    assert.equal(found.diff.match(/^diff --git /gm)?.length, UNTRACKED_FILES_CAP);
    assert.equal(found.overCap, 5);
  });

  it('never hands git a file name, so one shaped like an option is just a file', async () => {
    const repo = origin();
    write(repo, '--output=pwned.txt', 'looks like an option\n');
    const recorder = recording(readOnlyGit());

    const found = await untrackedDiff(recorder.git, repo);

    assert.match(found.diff, /^\+looks like an option$/m);
    assert.equal(existsSync(join(repo, 'pwned.txt')), false);
    for (const args of recorder.calls)
      assert.ok(!args.includes('--output=pwned.txt'), args.join(' '));
  });
});
