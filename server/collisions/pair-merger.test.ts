import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { gitPairMerger } from './pair-merger.ts';

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    encoding: 'utf8',
  });

/** An "origin" with three pull requests: #1 and #2 change the same line, #3 another file. */
function originWithPulls(): string {
  const origin = mkdtempSync(join(tmpdir(), 'observatory-origin-'));
  git(origin, 'init', '--quiet', '--initial-branch=main');
  writeFileSync(join(origin, 'a.txt'), 'base\n');
  writeFileSync(join(origin, 'b.txt'), 'base\n');
  git(origin, 'add', '.');
  git(origin, 'commit', '--quiet', '-m', 'base');
  const pull = (number: number, file: string, text: string) => {
    git(origin, 'checkout', '--quiet', '-b', `pr${number}`, 'main');
    writeFileSync(join(origin, file), text);
    git(origin, 'commit', '--quiet', '-am', `pr ${number}`);
    git(origin, 'update-ref', `refs/pull/${number}/head`, `pr${number}`);
  };
  pull(1, 'a.txt', 'one\n');
  pull(2, 'a.txt', 'two\n');
  pull(3, 'b.txt', 'three\n');
  git(origin, 'checkout', '--quiet', 'main');
  return origin;
}

describe('gitPairMerger', () => {
  it('finds the conflict, the clean pair and the missing head, then cleans up', async () => {
    const clone = join(mkdtempSync(join(tmpdir(), 'observatory-clone-')), 'clone');
    execFileSync('git', ['clone', '--quiet', originWithPulls(), clone]);
    const branchesBefore = git(clone, 'for-each-ref', '--format=%(refname)');

    const session = await gitPairMerger().open(clone, [1, 2, 3, 99]);

    assert.deepEqual(await session.conflicts(1, 2), ['a.txt']);
    assert.deepEqual(await session.conflicts(1, 3), []);
    assert.equal(await session.conflicts(1, 99), null);
    await session.close();
    assert.equal(git(clone, 'for-each-ref', '--format=%(refname)'), branchesBefore);
  });
});
